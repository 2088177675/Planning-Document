/* 注册页 Vue 应用：原生 form POST 到 /register，Flash 由 base.html 顶部显示 */
(function () {
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        form: { username: '', real_name: '', password: '', role: 'student' },
        urls: U
      };
    },
    methods: {
      go: function (url) { window.location.href = url; }
    },
    template: `
      <div class="page-vue" style="max-width:460px;margin:28px auto">
        <el-card shadow="always">
          <div class="vue-page-title">注册新账号</div>
          <div class="vue-page-sub">注册后即可报名参赛、提交悬赏解答；发布内容需先成为会员</div>
          <form :action="urls.register" method="POST" style="margin-top:18px">
            <el-input name="username" v-model="form.username" placeholder="登录用户名"
                      size="large" style="margin-bottom:14px"></el-input>
            <el-input name="real_name" v-model="form.real_name" placeholder="真实姓名（选填）"
                      size="large" style="margin-bottom:14px"></el-input>
            <el-input name="password" type="password" v-model="form.password" placeholder="登录密码"
                      size="large" show-password style="margin-bottom:14px"></el-input>
            <input type="hidden" name="role" :value="form.role">
            <el-select v-model="form.role" size="large" style="width:100%;margin-bottom:18px" placeholder="选择身份">
              <el-option label="学生" value="student"></el-option>
              <el-option label="老师" value="teacher"></el-option>
            </el-select>
            <el-button type="primary" size="large" native-type="submit" style="width:100%">立即注册</el-button>
          </form>
          <div class="vue-meta" style="margin-top:14px;justify-content:space-between">
            <a :href="urls.login" class="muted">已有账号？返回登录 →</a>
            <span class="muted">注册即同意平台规则</span>
          </div>
        </el-card>
      </div>
    `
  });
})();
