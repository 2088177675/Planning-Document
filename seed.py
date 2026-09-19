# -*- coding: utf-8 -*-
"""初始化种子数据：管理员账号 + 演示师生账号（均预充演示余额）

用法：python seed.py
"""
from flask import Flask
from werkzeug.security import generate_password_hash
from db import close_db, init_db, qone, execute
import services


def make_app():
    app = Flask(__name__)
    app.teardown_appcontext(close_db)
    return app


def ensure_user(username, password, real_name, role, is_member, balance):
    existing = qone('SELECT id FROM users WHERE username=?', (username,))
    if existing:
        return existing['id']
    cur = execute(
        '''INSERT INTO users (username, password_hash, real_name, role, is_member, balance, created_at)
           VALUES (?,?,?,?,?,?,?)''',
        (username, generate_password_hash(password), real_name, role,
         1 if is_member else 0, balance, services.now()))
    uid = cur.lastrowid
    if balance > 0:
        execute(
            '''INSERT INTO transactions (user_id, type, amount, direction, ref_type, ref_id,
                                         balance_after, note, created_at)
               VALUES (?, 'recharge', ?, 'in', '', NULL, ?, '初始演示余额', ?)''',
            (uid, balance, balance, services.now()))
    if is_member and role != 'admin':
        execute(
            '''INSERT INTO member_logs (user_id, action, operator_id, note, created_at)
               VALUES (?, 'approve', ?, '初始演示会员', ?)''',
            (uid, uid, services.now()))
    return uid


def main():
    app = make_app()
    with app.app_context():
        init_db()
        ensure_user('admin', 'admin123', '平台管理员', 'admin', 1, 99999)
        ensure_user('teacher1', '123456', '王老师', 'teacher', 1, 5000)
        ensure_user('student1', '123456', '张同学', 'student', 0, 1000)
        ensure_user('student2', '123456', '李同学', 'student', 0, 1000)
        ensure_user('student3', '123456', '赵同学', 'student', 1, 3000)
        print('种子数据初始化完成：')
        print('  管理员   admin / admin123  （永久会员，可审核监管）')
        print('  老师     teacher1 / 123456（会员，可发布）')
        print('  学生会员 student3 / 123456（会员，可发布）')
        print('  普通学生 student1 / 123456（非会员，可参与/可申请会员）')
        print('  普通学生 student2 / 123456（非会员，可参与/可申请会员）')


if __name__ == '__main__':
    main()
