# -*- coding: utf-8 -*-
"""文件上传/下载辅助（保留中文文件名，uuid 前缀防冲突）"""
import os
import re
import uuid
from db import UPLOAD_DIR


def safe_name(filename):
    filename = os.path.basename(filename or '')
    return re.sub(r'[\\/:*?"<>|]+', '_', filename).strip() or 'file'


def save_upload(fs):
    """返回 (原始文件名, 存储文件名)；无文件返回 ('','')"""
    if not fs or not getattr(fs, 'filename', ''):
        return '', ''
    orig = safe_name(fs.filename)
    stored = uuid.uuid4().hex + '_' + orig
    fs.save(os.path.join(UPLOAD_DIR, stored))
    return orig, stored
