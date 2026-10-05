# -*- coding: utf-8 -*-
"""经典棋类合集 APK 构建流水线（无需 Gradle/AGP，复用 biancheng-app/_build 工具链）：
   aapt2 编译链接 -> javac -> d8 转 dex -> 组装 zip -> zipalign -> apksigner 签名。
   零权限应用：不申请任何 android permission，完全离线。
"""
import glob
import os
import shutil
import subprocess
import sys
import zipfile

HERE = os.path.dirname(os.path.abspath(__file__))      # chess-collection/android
ROOT = os.path.dirname(HERE)                           # chess-collection
BUILD = os.path.join(os.path.dirname(ROOT), 'biancheng-app', '_build')
BT = os.path.join(BUILD, 'android-14')
PLAT_JAR = os.path.join(BUILD, 'android-34', 'android.jar')
OUT = os.path.join(HERE, 'build')
DIST = os.path.join(ROOT, 'dist')
VERSION = '1.4'
APK = os.path.join(DIST, 'jingdian-qilei-v%s.apk' % VERSION)


def run(cmd):
    print('>>', ' '.join(cmd))
    r = subprocess.run(cmd)
    if r.returncode != 0:
        sys.exit('命令失败（退出码 %d）: %s' % (r.returncode, ' '.join(cmd)))


def check_tools():
    missing = [p for p in [os.path.join(BT, 'aapt2.exe'), PLAT_JAR,
                           os.path.join(BT, 'lib', 'd8.jar'),
                           os.path.join(BT, 'lib', 'apksigner.jar'),
                           os.path.join(BT, 'zipalign.exe')] if not os.path.exists(p)]
    if missing:
        sys.exit('缺少工具链文件（先从腾讯镜像下载并解包 _build/）：\n' + '\n'.join(missing))


def step_assets():
    dst = os.path.join(HERE, 'assets')
    os.makedirs(dst, exist_ok=True)
    for item in ['index.html', 'css', 'js']:
        s = os.path.join(ROOT, 'app', item)
        d = os.path.join(dst, item)
        if os.path.isdir(s):
            shutil.copytree(s, d, dirs_exist_ok=True)
        elif os.path.exists(s):
            shutil.copy2(s, d)
    print('[1/6] assets 同步完成')


def step_aapt2():
    os.makedirs(OUT, exist_ok=True)
    res_zip = os.path.join(OUT, 'res.zip')
    run([os.path.join(BT, 'aapt2.exe'), 'compile', '--dir',
         os.path.join(HERE, 'res'), '-o', res_zip])
    run([os.path.join(BT, 'aapt2.exe'), 'link', '-o', os.path.join(OUT, 'base.apk'),
         '-I', PLAT_JAR,
         '--manifest', os.path.join(HERE, 'AndroidManifest.xml'),
         '-A', os.path.join(HERE, 'assets'),
         '--min-sdk-version', '21', '--target-sdk-version', '34',
         '--version-code', VERSION.replace('.', ''), '--version-name', VERSION,
         '--auto-add-overlay', res_zip])
    print('[2/6] 资源编译链接完成 (base.apk)')


def step_javac():
    cls = os.path.join(OUT, 'classes')
    shutil.rmtree(cls, ignore_errors=True)
    os.makedirs(cls)
    srcs = glob.glob(os.path.join(HERE, 'src', '**', '*.java'), recursive=True)
    run(['javac', '--release', '11', '-encoding', 'UTF-8',
         '-classpath', PLAT_JAR, '-d', cls] + srcs)
    print('[3/6] Java 编译完成')


def step_d8():
    dexdir = os.path.join(OUT, 'dex')
    shutil.rmtree(dexdir, ignore_errors=True)
    os.makedirs(dexdir)
    clss = glob.glob(os.path.join(OUT, 'classes', '**', '*.class'), recursive=True)
    # build-tools 34 自带的 d8(R8 8.2.2-dev) 在新版 JDK 上有 NPE，优先用下载的新版 R8
    r8_new = os.path.join(BUILD, 'r8-9.4.28.jar')
    d8_jar = r8_new if os.path.exists(r8_new) else os.path.join(BT, 'lib', 'd8.jar')
    run(['java', '-cp', d8_jar,
         'com.android.tools.r8.D8', '--release', '--lib', PLAT_JAR,
         '--min-api', '21', '--output', dexdir] + clss)
    print('[4/6] dex 转换完成')


def step_assemble():
    base = os.path.join(OUT, 'base.apk')
    unsigned = os.path.join(OUT, 'unsigned.apk')
    with zipfile.ZipFile(base) as zin, \
            zipfile.ZipFile(unsigned, 'w', zipfile.ZIP_DEFLATED) as zout:
        for info in zin.infolist():
            data = zin.read(info.filename)
            zi = zipfile.ZipInfo(info.filename, date_time=info.date_time)
            # Android 11+ 要求 resources.arsc 不压缩
            zi.compress_type = (zipfile.ZIP_STORED
                                if info.filename == 'resources.arsc' else info.compress_type)
            zi.external_attr = info.external_attr
            zout.writestr(zi, data)
        zout.write(os.path.join(OUT, 'dex', 'classes.dex'), 'classes.dex')
    print('[5/6] APK 组装完成')


def step_align_sign():
    os.makedirs(DIST, exist_ok=True)
    aligned = os.path.join(OUT, 'aligned.apk')
    run([os.path.join(BT, 'zipalign.exe'), '-f', '4',
         os.path.join(OUT, 'unsigned.apk'), aligned])
    ks = os.path.join(BUILD, 'debug.keystore')
    if not os.path.exists(ks):
        run(['keytool', '-genkeypair', '-keystore', ks, '-storetype', 'PKCS12',
             '-storepass', 'android', '-keypass', 'android',
             '-alias', 'androiddebugkey', '-keyalg', 'RSA', '-keysize', '2048',
             '-validity', '10000', '-dname', 'CN=Android Debug,O=Android,C=US'])
    run(['java', '-jar', os.path.join(BT, 'lib', 'apksigner.jar'), 'sign',
         '--ks', ks, '--ks-pass', 'pass:android', '--key-pass', 'pass:android',
         '--ks-key-alias', 'androiddebugkey', '--out', APK, aligned])
    print('[6/6] 签名完成')
    print('=' * 46)
    print('APK 产物: %s (%.1f MB)' % (APK, os.path.getsize(APK) / 1048576))
    print('=' * 46)


if __name__ == '__main__':
    check_tools()
    step_assets()
    step_aapt2()
    step_javac()
    step_d8()
    step_assemble()
    step_align_sign()
