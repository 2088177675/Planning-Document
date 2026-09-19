/* AI 调用日志管理后台 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        items: data.items || [],
        summary: data.summary || {},
        status: data.status || '',
        urls: U
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 19) : '—'; },
      setStatus: function (s) { window.location.href = U.adminLearnLogs + (s ? '?status=' + s : ''); }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">🤖 AI 调用日志</h1>
            <div class="vue-page-sub">监控平台所有 AI 生成与助学调用，包含成功/失败、耗时、提示词摘要</div>
          </div>
          <div>
            <el-button type="primary" @click="go(urls.adminDashboard)">← 返回仪表盘</el-button>
          </div>
        </div>

        <el-row :gutter="12" style="margin-bottom:16px">
          <el-col :xs="12" :sm="6">
            <el-card shadow="hover"><div style="font-size:22px;font-weight:800;color:#2563eb">{{ summary.total || 0 }}</div><div class="muted">累计调用</div></el-card>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-card shadow="hover"><div style="font-size:22px;font-weight:800;color:#16a34a">{{ summary.success || 0 }}</div><div class="muted">成功</div></el-card>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-card shadow="hover"><div style="font-size:22px;font-weight:800;color:#dc2626">{{ summary.failed || 0 }}</div><div class="muted">失败</div></el-card>
          </el-col>
          <el-col :xs="12" :sm="6">
            <el-card shadow="hover"><div style="font-size:22px;font-weight:800;color:#f59e0b">{{ summary.today || 0 }}</div><div class="muted">今日调用</div></el-card>
          </el-col>
        </el-row>

        <div class="vue-filter-bar">
          <el-radio-group :model-value="status" @change="setStatus">
            <el-radio-button label="">全部</el-radio-button>
            <el-radio-button label="success">成功</el-radio-button>
            <el-radio-button label="failed">失败</el-radio-button>
          </el-radio-group>
        </div>

        <el-empty v-if="!items.length" description="暂无 AI 调用日志"></el-empty>
        <el-table v-else :data="items" size="small" style="width:100%">
          <el-table-column label="时间" width="160"><template #default="scope">{{ fullTime(scope.row.created_at) }}</template></el-table-column>
          <el-table-column label="用户" prop="username" width="120"></el-table-column>
          <el-table-column label="动作" prop="action" width="160"></el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="scope">
              <el-tag size="small" :type="scope.row.status === 'success' ? 'success' : 'danger'">{{ scope.row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="耗时" width="90"><template #default="scope">{{ scope.row.cost_ms }} ms</template></el-table-column>
          <el-table-column label="提示词摘要" min-width="240"><template #default="scope">{{ (scope.row.prompt || '').slice(0, 80) }}</template></el-table-column>
          <el-table-column label="结果摘要" min-width="240"><template #default="scope">{{ (scope.row.result || '').slice(0, 80) }}</template></el-table-column>
        </el-table>
      </div>
    `
  });
})();
