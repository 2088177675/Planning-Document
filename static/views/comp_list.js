/* 竞赛广场 Vue 应用：筛选条件变化时跳转新 URL，由后端重新查询 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;
  var COMP = window.__COMP_STATUS__;

  window.__bootVueApp({
    data: function () {
      return {
        comps: data.comps || [],
        subjects: data.subjects || [],
        filter: {
          status: data.status || '',
          subject: data.subject || '',
          sort: data.sort || 'new'
        },
        user: window.__USER__,
        urls: U
      };
    },
    computed: {
      canPublish: function () {
        return this.user && (this.user.is_member || this.user.role === 'admin');
      }
    },
    methods: {
      go: function (url) { window.location.href = url; },
      money: function (n) { return '¥' + Number(n || 0).toFixed(2); },
      moneyShort: function (n) { return '¥' + Number(n || 0).toFixed(0); },
      shortTime: function (s) { return s ? String(s).slice(5, 16).replace('T', ' ') : '—'; },
      statusInfo: function (s) { return (window.__COMP_STATUS__ || {})[s] || { label: s, type: 'info' }; },
      phaseInfo: function (c) { return window.__compPhase(c, ''); },
      applyFilter: function () {
        var p = new URLSearchParams();
        if (this.filter.status) p.set('status', this.filter.status);
        if (this.filter.subject) p.set('subject', this.filter.subject);
        if (this.filter.sort && this.filter.sort !== 'new') p.set('sort', this.filter.sort);
        var q = p.toString();
        window.location.href = this.urls.compList + (q ? '?' + q : '');
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">竞赛广场</h1>
            <div class="vue-page-sub">浏览全部公开竞赛，按奖金、学科、截止时间筛选；报名免费、奖金托管</div>
          </div>
          <el-button v-if="canPublish" type="primary" size="large" @click="go(urls.compPublish)">＋ 发布新竞赛</el-button>
        </div>

        <el-card shadow="never" class="vue-filter-bar" style="margin-bottom:18px">
          <el-row :gutter="12">
            <el-col :xs="24" :sm="8" :md="6">
              <div class="muted" style="font-size:12px;margin-bottom:4px">状态</div>
              <el-select v-model="filter.status" placeholder="全部状态" size="default" style="width:100%" @change="applyFilter">
                <el-option label="全部状态" value=""></el-option>
                <el-option label="进行中（报名/作答）" value="open"></el-option>
                <el-option label="待结算" value="ended"></el-option>
                <el-option label="已结算" value="settled"></el-option>
                <el-option label="已流标" value="failed"></el-option>
                <el-option label="已终止" value="terminated"></el-option>
              </el-select>
            </el-col>
            <el-col :xs="24" :sm="8" :md="6">
              <div class="muted" style="font-size:12px;margin-bottom:4px">学科</div>
              <el-select v-model="filter.subject" placeholder="全部学科" filterable clearable size="default" style="width:100%" @change="applyFilter">
                <el-option v-for="s in subjects" :key="s" :label="s" :value="s"></el-option>
              </el-select>
            </el-col>
            <el-col :xs="24" :sm="8" :md="6">
              <div class="muted" style="font-size:12px;margin-bottom:4px">排序</div>
              <el-select v-model="filter.sort" size="default" style="width:100%" @change="applyFilter">
                <el-option label="最新发布" value="new"></el-option>
                <el-option label="奖金最高" value="prize"></el-option>
                <el-option label="截止最近" value="end"></el-option>
              </el-select>
            </el-col>
            <el-col :xs="24" :md="6" style="display:flex;align-items:flex-end;justify-content:flex-end">
              <el-button @click="filter.status=''; filter.subject=''; filter.sort='new'; applyFilter()" size="default">重置筛选</el-button>
            </el-col>
          </el-row>
        </el-card>

        <el-row :gutter="16" v-if="comps.length">
          <el-col :xs="24" :sm="12" :md="8" v-for="c in comps" :key="c.id" style="margin-bottom:16px">
            <el-card shadow="hover" class="vue-item-card" @click="go(urls.compDetail(c.id))">
              <div class="vue-card-title"><a :href="urls.compDetail(c.id)" @click.prevent>{{ c.title }}</a></div>
              <div class="vue-meta">
                <el-tag size="small" type="primary">{{ c.subject || '综合' }}</el-tag>
                <el-tag size="small" :type="c.mode === 'team' ? 'warning' : 'info'">{{ c.mode === 'team' ? '团队赛' : '个人赛' }}</el-tag>
                <el-tag size="small" :type="c.eval_mode === 'manual' ? 'info' : 'success'">{{ c.eval_mode === 'manual' ? '人工评测' : '自动评测' }}</el-tag>
                <el-tag v-if="c.difficulty" size="small" type="info" effect="plain">{{ c.difficulty }}</el-tag>
              </div>
              <div class="vue-meta">
                <span>👤 {{ c.publisher_name }}</span>
                <span>🙋 已报名 {{ c.signup_count }} 人</span>
                <span>⏰ 截止 {{ shortTime(c.submit_deadline) }}</span>
              </div>
              <div class="vue-card-footer">
                <span class="vue-prize">{{ money(c.prize_amount) }}</span>
                <el-button type="primary" size="small" @click.stop="go(urls.compDetail(c.id))">查看详情</el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>
        <el-empty v-else description="暂无符合条件的竞赛，试试更换筛选条件或发布第一场竞赛"></el-empty>
      </div>
    `
  });
})();
