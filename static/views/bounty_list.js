/* 悬赏广场 Vue 应用 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;
  var BOUNTY = window.__BOUNTY_STATUS__;

  window.__bootVueApp({
    data: function () {
      return {
        items: data.items || [],
        subjects: data.subjects || [],
        now: data.now || '',
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
      statusInfo: function (s) { return (window.__BOUNTY_STATUS__ || {})[s] || { label: s, type: 'info' }; },
      applyFilter: function () {
        var p = new URLSearchParams();
        if (this.filter.status) p.set('status', this.filter.status);
        if (this.filter.subject) p.set('subject', this.filter.subject);
        if (this.filter.sort && this.filter.sort !== 'new') p.set('sort', this.filter.sort);
        var q = p.toString();
        window.location.href = this.urls.bountyList + (q ? '?' + q : '');
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">悬赏广场</h1>
            <div class="vue-page-sub">浏览全部悬赏任务，免费提交解答，被采纳即获全额赏金</div>
          </div>
          <el-button v-if="canPublish" type="success" size="large" @click="go(urls.bountyPublish)">＋ 发布新悬赏</el-button>
        </div>

        <el-card shadow="never" class="vue-filter-bar" style="margin-bottom:18px">
          <el-row :gutter="12">
            <el-col :xs="24" :sm="8" :md="6">
              <div class="muted" style="font-size:12px;margin-bottom:4px">状态</div>
              <el-select v-model="filter.status" placeholder="全部状态" size="default" style="width:100%" @change="applyFilter">
                <el-option label="全部状态" value=""></el-option>
                <el-option label="待解决" value="open"></el-option>
                <el-option label="已解决" value="resolved"></el-option>
                <el-option label="已过期" value="expired"></el-option>
                <el-option label="已下架" value="terminated"></el-option>
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
                <el-option label="赏金最高" value="bounty"></el-option>
                <el-option label="截止最近" value="expire"></el-option>
              </el-select>
            </el-col>
            <el-col :xs="24" :md="6" style="display:flex;align-items:flex-end;justify-content:flex-end">
              <el-button @click="filter.status=''; filter.subject=''; filter.sort='new'; applyFilter()" size="default">重置筛选</el-button>
            </el-col>
          </el-row>
        </el-card>

        <el-row :gutter="16" v-if="items.length">
          <el-col :xs="24" :sm="12" :md="8" v-for="b in items" :key="b.id" style="margin-bottom:16px">
            <el-card shadow="hover" class="vue-item-card" @click="go(urls.bountyDetail(b.id))">
              <div class="vue-card-title"><a :href="urls.bountyDetail(b.id)" @click.prevent>{{ b.title }}</a></div>
              <div class="vue-meta">
                <el-tag size="small" type="success">{{ b.subject || '通用' }}</el-tag>
                <el-tag v-if="b.tags" size="small" type="info" effect="plain">{{ b.tags }}</el-tag>
                <span>💬 {{ b.answer_count }} 人解答</span>
                <span>⏰ {{ shortTime(b.expire_at) }} 截止</span>
              </div>
              <div class="vue-card-footer">
                <span class="vue-prize">{{ money(b.bounty_amount) }}</span>
                <el-button type="success" size="small" @click.stop="go(urls.bountyDetail(b.id))">去解答</el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>
        <el-empty v-else description="暂无符合条件的悬赏，试试更换筛选或发布一条悬赏"></el-empty>
      </div>
    `
  });
})();
