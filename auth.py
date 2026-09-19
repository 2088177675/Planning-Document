# -*- coding: utf-8 -*-
"""认证与权限：注册、登录、登出、会员申请"""
from functools import wraps
from flask import (Blueprint, request, redirect, url_for, session, flash,
                   render_template, g)
from werkzeug.security import generate_password_hash, check_password_hash
from db import q, qone, execute
import services

bp = Blueprint('auth', __name__)

ROLE_NAMES = {'student': '学生', 'teacher': '老师', 'admin': '管理员'}


def login_required(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        if g.get('user') is None:
            flash('请先登录后再操作', 'warn')
            return redirect(url_for('auth.login', next=request.path))
        return f(*args, **kwargs)
    return wrapped


def member_required(f):
    """仅会员（含管理员）可发布内容"""
    @wraps(f)
    def wrapped(*args, **kwargs):
        if g.get('user') is None:
            flash('请先登录后再操作', 'warn')
            return redirect(url_for('auth.login', next=request.path))
        u = g.user
        if not (u['is_member'] or u['role'] == 'admin'):
            flash('仅认证会员可发布竞赛/悬赏，可前往个人中心申请会员', 'warn')
            return redirect(url_for('main.profile'))
        return f(*args, **kwargs)
    return wrapped


def admin_required(f):
    @wraps(f)
    def wrapped(*args, **kwargs):
        if g.get('user') is None or g.user['role'] != 'admin':
            flash('需要管理员权限', 'error')
            return redirect(url_for('main.index'))
        return f(*args, **kwargs)
    return wrapped


@bp.route('/register', methods=['GET', 'POST'])
def register():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        real_name = request.form.get('real_name', '').strip()
        role = request.form.get('role', 'student')
        if not username or not password:
            flash('用户名和密码不能为空', 'error')
            return render_template('auth/register.html')
        if role not in ('student', 'teacher'):
            role = 'student'
        if qone('SELECT id FROM users WHERE username=?', (username,)):
            flash('用户名已存在', 'error')
            return render_template('auth/register.html')
        execute(
            '''INSERT INTO users (username, password_hash, real_name, role, is_member, balance, created_at)
               VALUES (?,?,?,?,0,0,?)''',
            (username, generate_password_hash(password), real_name, role, services.now()))
        flash('注册成功，请登录', 'ok')
        return redirect(url_for('auth.login'))
    return render_template('auth/register.html')


@bp.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form.get('username', '').strip()
        password = request.form.get('password', '').strip()
        u = qone('SELECT * FROM users WHERE username=?', (username,))
        if u is None or not check_password_hash(u['password_hash'], password):
            flash('用户名或密码错误', 'error')
            return render_template('auth/login.html')
        session.clear()
        session['user_id'] = u['id']
        flash('欢迎回来，%s' % (u['real_name'] or u['username']), 'ok')
        nxt = request.args.get('next')
        return redirect(nxt or url_for('main.index'))
    return render_template('auth/login.html')


@bp.route('/logout')
def logout():
    session.clear()
    flash('已退出登录', 'ok')
    return redirect(url_for('main.index'))


@bp.route('/member/apply', methods=['POST'])
@login_required
def member_apply():
    reason = request.form.get('reason', '').strip()
    u = g.user
    if u['is_member'] or u['role'] == 'admin':
        flash('您已是会员，无需重复申请', 'warn')
        return redirect(url_for('main.profile'))
    ok, msg = services.apply_member(u['id'], reason or '无')
    flash(msg, 'ok' if ok else 'error')
    return redirect(url_for('main.profile'))
