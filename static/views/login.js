/* 登录页 Vue 应用：原生 form POST 到 /login，Flask 处理后跳转 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        form: { username: '', password: '' },
        next: data.next || '',
        urls: U
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      onSubmit: function () { return true; }
    },
    template: `
      <div class="page-vue" style="max-width:440px;margin:28px auto">
        <el-card shadow="always">
          <div class="vue-page-title">欢迎登录</div>
          <div class="vue-page-sub">公开竞赛 &amp; 悬赏平台 · 奖金托管、平台零分成</div>
          <form :action="urls.login" method="POST" style="margin-top:18px" @submit="onSubmit">
            <input v-if="next" type="hidden" name="next" :value="next">
            <el-input name="username" v-model="form.username" placeholder="用户名"
                      size="large" prefix-icon="User" style="margin-bottom:14px"></el-input>
            <el-input name="password" type="password" v-model="form.password" placeholder="密码"
                      size="large" prefix-icon="Lock" show-password style="margin-bottom:18px"></el-input>
            <el-button type="primary" size="large" native-type="submit" style="width:100%">登录</el-button>
          </form>
          <div class="vue-meta" style="margin-top:14px;justify-content:space-between">
            <a :href="urls.register" class="muted">没有账号？立即注册 →</a>
            <span class="muted">演示：admin / admin123</span>
          </div>
          <div class="vue-announce" style="margin-top:10px">
            其他演示账号：teacher1/123456 · student1/123456 · student2/123456 · student3/123456
          </div>
        </el-card>
      </div>
    `
  });
})();
