/* 内容监管 - 举报处理 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        items: data.items || [],
        status: data.status || 'pending',
        urls: U
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      setStatus: function (s) { window.location.href = U.adminLearnReports + '?status=' + s; },
      handleForm: function (rid, action) {
        var note = prompt(action === 'takedown' ? '下架备注（可空，默认"已下架违规资料")' : '驳回理由（可空）', '');
        if (note === null) return;
        var f = document.createElement('form');
        f.method = 'POST';
        f.action = '/admin/learn/report/' + rid + '/handle';
        var a = document.createElement('input'); a.type = 'hidden'; a.name = 'action'; a.value = action; f.appendChild(a);
        var n = document.createElement('input'); n.type = 'hidden'; n.name = 'note'; n.value = note || ''; f.appendChild(n);
        document.body.appendChild(f); f.submit();
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">🚩 内容监管 · 举报处理</h1>
            <div class="vue-page-sub">处理用户举报的违规公开资料；下架将自动设为私有</div>
          </div>
          <el-button type="primary" @click="go(urls.adminDashboard)">← 返回仪表盘</el-button>
        </div>

        <div class="vue-filter-bar">
          <el-radio-group :model-value="status" @change="setStatus">
            <el-radio-button label="pending">待处理</el-radio-button>
            <el-radio-button label="resolved">已下架</el-radio-button>
            <el-radio-button label="dismissed">已驳回</el-radio-button>
          </el-radio-group>
        </div>

        <el-empty v-if="!items.length" description="暂无符合的举报记录"></el-empty>
        <el-table v-else :data="items" size="small" style="width:100%">
          <el-table-column label="举报时间" width="150"><template #default="scope">{{ fullTime(scope.row.created_at) }}</template></el-table-column>
          <el-table-column label="举报人" prop="reporter_name" width="120"></el-table-column>
          <el-table-column label="资料标题" min-width="200"><template #default="scope"><a :href="urls.learnMaterial(scope.row.material_id)">{{ scope.row.material_title }}</a></template></el-table-column>
          <el-table-column label="理由" prop="reason" min-width="200"></el-table-column>
          <el-table-column label="状态" width="100">
            <template #default="scope">
              <el-tag size="small" :type="scope.row.status === 'pending' ? 'warning' : scope.row.status === 'resolved' ? 'success' : 'info'">{{ scope.row.status }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="处理人" prop="handler_name" width="100"></el-table-column>
          <el-table-column label="操作" width="180">
            <template #default="scope">
              <template v-if="scope.row.status === 'pending'">
                <el-button size="small" type="danger" @click="handleForm(scope.row.id, 'takedown')">下架</el-button>
                <el-button size="small" @click="handleForm(scope.row.id, 'dismiss')">驳回</el-button>
              </template>
              <span v-else class="muted">{{ fullTime(scope.row.handled_at) }}</span>
            </template>
          </el-table-column>
        </el-table>
      </div>
    `
  });
})();
