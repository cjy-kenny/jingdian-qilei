# -*- coding: utf-8 -*-
"""生成微信传输用安装包：zip 内放一个中文命名的 APK（与随身编程项目同款流程）。"""
import os
import zipfile
import sys

D = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'dist')
VER = sys.argv[1] if len(sys.argv) > 1 else '1.2'
src = os.path.join(D, 'jingdian-qilei-v%s.apk' % VER)
dst = os.path.join(D, '经典棋类合集-安装包-v%s.zip' % VER)
inner = '经典棋类合集-v%s.apk' % VER

with zipfile.ZipFile(dst, 'w', zipfile.ZIP_DEFLATED) as z:
    z.write(src, inner)

with zipfile.ZipFile(dst) as z:
    for i in z.infolist():
        print(i.filename, i.file_size, 'bytes')
print('zip: %d KB -> %s' % (os.path.getsize(dst) // 1024, dst))
