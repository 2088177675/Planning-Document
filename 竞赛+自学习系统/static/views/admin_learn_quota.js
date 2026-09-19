/* AI 配额管理 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        items: data.items || [],
        urls: U,
        editMap: {} // uid -> daily_limit
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      resetDate: function (s) { return s || '—'; },
      save: function (uid) {
        var v = this.editMap[uid];
        if (v === undefined) return;
        var f = document.createElement('form');
        f.method = 'POST'; f.action = '/admin/learn/quota/' + uid + '/update';
        var i = document.createElement('input'); i.type = 'hidden'; i.name = 'daily_limit'; i.value = v; f.appendChild(i);
        document.body.appendChild(f); f.submit();
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">⚙️ AI 配额管理</h1>
            <div class="vue-page-sub">配置每位用户每日 AI 生成调用上限，跨日自动重置</div>
          </div>
          <el-button type="primary" @click="go(urls.adminDashboard)">← 返回仪表盘</el-button>
        </div>

        <el-empty v-if="!items.length" description="暂无配额记录（用户首次 AI 调用后自动生成）"></el-empty>
        <el-table v-else :data="items" size="small" style="width:100%">
          <el-table-column label="用户" prop="username" width="140"></el-table-column>
          <el-table-column label="真实姓名" prop="real_name" width="140"></el-table-column>
          <el-table-column label="角色" width="100">
            <template #default="scope">
              <el-tag size="small" :type="scope.row.role === 'teacher' ? 'warning' : scope.row.role === 'admin' ? 'danger' : 'info'">
                {{ scope.row.role === 'teacher' ? '老师' : scope.row.role === 'admin' ? '管理员' : '学生' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="每日上限" width="200">
            <template #default="scope">
              <el-input-number v-model="editMap[scope.row.user_id]" :placeholder="String(scope.row.daily_limit)"
                :min="0" :max="1000" size="small" style="width:140px"></el-input-number>
            </template>
          </el-table-column>
          <el-table-column label="今日已用" width="100">
            <template #default="scope">{{ scope.row.used_today }} / {{ scope.row.daily_limit }}</template>
          </el-table-column>
          <el-table-column label="重置日" width="120"><template #default="scope">{{ resetDate(scope.row.reset_date) }}</template></el-table-column>
          <el-table-column label="操作" width="100">
            <template #default="scope"><el-button size="small" type="primary" @click="save(scope.row.user_id)">保存</el-button></template>
          </el-table-column>
        </el-table>
      </div>
    `
  });
})();
