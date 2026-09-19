/* 会员管理 Vue 应用：审核/撤销用动态 form POST */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        pending: data.pending || [],
        memberList: data.memberList || [],
        logs: data.logs || [],
        urls: U,
        reviewDialog: { open: false, app: null, action: 'approve', note: '' },
        revokeDialog: { open: false, user: null, note: '' }
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      shortTime: function (s) { return s ? String(s).slice(5, 16).replace('T', ' ') : '—'; },
      postForm: function (action, fields) {
        var f = document.createElement('form');
        f.method = 'POST'; f.action = action; f.style.display = 'none';
        Object.keys(fields || {}).forEach(function (k) {
          var i = document.createElement('input');
          i.type = 'hidden'; i.name = k; i.value = fields[k];
          f.appendChild(i);
        });
        document.body.appendChild(f);
        f.submit();
      },
      openReview: function (app, action) {
        this.reviewDialog.app = app;
        this.reviewDialog.action = action;
        this.reviewDialog.note = '';
        this.reviewDialog.open = true;
      },
      doReview: function () {
        var app = this.reviewDialog.app;
        if (!app) return;
        this.postForm('/admin/member/' + app.id + '/review', {
          action: this.reviewDialog.action,
          note: this.reviewDialog.note
        });
      },
      openRevoke: function (u) {
        this.revokeDialog.user = u;
        this.revokeDialog.note = '';
        this.revokeDialog.open = true;
      },
      doRevoke: function () {
        var u = this.revokeDialog.user;
        if (!u) return;
        this.postForm('/admin/member/' + u.id + '/revoke', { note: this.revokeDialog.note });
      },
      actionLabel: function (a) {
        var m = { apply: '申请', approve: '通过', reject: '驳回', revoke: '撤销' };
        return m[a] || a;
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">会员管理</h1>
            <div class="vue-page-sub">审核用户会员申请，或撤销已开通会员</div>
          </div>
        </div>

        <el-card shadow="never" style="margin-bottom:16px">
          <div class="vue-section-title">待审核申请（{{ pending.length }}）</div>
          <el-empty v-if="!pending.length" description="无待审核申请"></el-empty>
          <el-table v-else :data="pending" size="small" style="width:100%">
            <el-table-column label="申请人" width="160">
              <template #default="scope">
                <div>{{ scope.row.real_name || scope.row.username }}</div>
                <div class="muted" style="font-size:12px">@{{ scope.row.username }} · {{ scope.row.role }}</div>
              </template>
            </el-table-column>
            <el-table-column label="申请理由" min-width="200" prop="reason"></el-table-column>
            <el-table-column label="提交时间" width="160">
              <template #default="scope">{{ fullTime(scope.row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="180">
              <template #default="scope">
                <el-button size="small" type="success" @click="openReview(scope.row, 'approve')">通过</el-button>
                <el-button size="small" type="danger" @click="openReview(scope.row, 'reject')">驳回</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="never" style="margin-bottom:16px">
          <div class="vue-section-title">正式会员（{{ memberList.length }}）</div>
          <el-empty v-if="!memberList.length" description="暂无会员"></el-empty>
          <el-table v-else :data="memberList" size="small" style="width:100%">
            <el-table-column label="用户名" prop="username" width="140"></el-table-column>
            <el-table-column label="真实姓名" width="140">
              <template #default="scope">{{ scope.row.real_name || '—' }}</template>
            </el-table-column>
            <el-table-column label="角色" prop="role" width="100"></el-table-column>
            <el-table-column label="余额" width="120">
              <template #default="scope">¥{{ Number(scope.row.balance).toFixed(2) }}</template>
            </el-table-column>
            <el-table-column label="通过时间" width="160">
              <template #default="scope">{{ fullTime(scope.row.approved_at) }}</template>
            </el-table-column>
            <el-table-column label="操作" width="120">
              <template #default="scope">
                <el-button size="small" type="warning" plain @click="openRevoke(scope.row)">撤销会员</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <el-card shadow="never">
          <div class="vue-section-title">操作日志（最近 50 条）</div>
          <el-empty v-if="!logs.length" description="暂无日志"></el-empty>
          <el-table v-else :data="logs" size="small" style="width:100%">
            <el-table-column label="时间" width="160">
              <template #default="scope">{{ fullTime(scope.row.created_at) }}</template>
            </el-table-column>
            <el-table-column label="用户" prop="username" width="140"></el-table-column>
            <el-table-column label="动作" width="100">
              <template #default="scope">
                <el-tag size="small" :type="scope.row.action === 'approve' ? 'success' : (scope.row.action === 'reject' || scope.row.action === 'revoke' ? 'danger' : 'info')">
                  {{ actionLabel(scope.row.action) }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="备注" min-width="200" prop="note"></el-table-column>
          </el-table>
        </el-card>

        <el-dialog v-model="reviewDialog.open" title="审核会员申请" width="440px">
          <div v-if="reviewDialog.app" style="margin-bottom:12px">
            <div class="muted">申请人</div>
            <div style="font-weight:700">{{ reviewDialog.app.real_name || reviewDialog.app.username }}</div>
            <div class="muted" style="font-size:12px;margin-top:6px">申请理由：{{ reviewDialog.app.reason }}</div>
          </div>
          <el-input v-model="reviewDialog.note" type="textarea" :rows="3"
                    :placeholder="reviewDialog.action === 'approve' ? '审核备注（可选）' : '请填写驳回理由'"></el-input>
          <template #footer>
            <el-button @click="reviewDialog.open = false">取消</el-button>
            <el-button :type="reviewDialog.action === 'approve' ? 'success' : 'danger'" @click="doReview">
              {{ reviewDialog.action === 'approve' ? '确认通过' : '确认驳回' }}
            </el-button>
          </template>
        </el-dialog>

        <el-dialog v-model="revokeDialog.open" title="撤销会员资格" width="440px">
          <div v-if="revokeDialog.user" style="margin-bottom:12px">
            <div class="muted">用户</div>
            <div style="font-weight:700">{{ revokeDialog.user.real_name || revokeDialog.user.username }}（@{{ revokeDialog.user.username }}）</div>
          </div>
          <el-input v-model="revokeDialog.note" type="textarea" :rows="3" placeholder="请填写撤销理由"></el-input>
          <template #footer>
            <el-button @click="revokeDialog.open = false">取消</el-button>
            <el-button type="danger" @click="doRevoke">确认撤销</el-button>
          </template>
        </el-dialog>
      </div>
    `
  });
})();
