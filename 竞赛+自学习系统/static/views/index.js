/* 首页 Vue 应用 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        hotComps: data.hotComps || [],
        hotBounties: data.hotBounties || [],
        stats: data.stats || {},
        now: data.now || '',
        user: window.__USER__,
        urls: U
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      money: function (n) { return '¥' + Number(n || 0).toFixed(2); },
      moneyShort: function (n) { return '¥' + Number(n || 0).toFixed(0); },
      shortTime: function (s) { return s ? String(s).slice(5, 16) : '—'; }
    },
    template: `
      <div class="page-vue">
        <div class="hero">
          <h1>公开竞赛 &amp; 悬赏平台</h1>
          <p>对标 Kaggle 悬赏竞赛模式：会员发布赛事与求助，奖金/赏金发布前全额托管、平台零分成；
             全体用户免费报名参赛、解答悬赏，冠军与采纳者自动获得奖金。流标、过期、违规下架资金原路退回。</p>
          <div style="margin-bottom:22px">
            <el-button type="primary" size="large" round @click="go(urls.compList)">浏览竞赛广场</el-button>
            <el-button size="large" round class="hero-outline" @click="go(urls.bountyList)">接单赚赏金</el-button>
          </div>
          <el-row :gutter="16">
            <el-col :xs="12" :sm="6" v-for="(s, k) in [
              {num: stats.comp_total, label: '公开竞赛'},
              {num: stats.bounty_total, label: '悬赏任务'},
              {num: stats.user_total, label: '注册用户'},
              {num: moneyShort(stats.payout_total), label: '累计发放奖金'}
            ]" :key="k">
              <div class="stat-box"><div class="num">{{ s.num }}</div><div class="label">{{ s.label }}</div></div>
            </el-col>
          </el-row>
        </div>

        <div class="vue-section-head">
          <h2>🔥 热门竞赛</h2>
          <a :href="urls.compList" class="muted">进入竞赛广场 →</a>
        </div>
        <el-row :gutter="16" v-if="hotComps.length">
          <el-col :xs="24" :sm="12" :md="8" v-for="c in hotComps" :key="c.id" style="margin-bottom:16px">
            <el-card shadow="hover" class="vue-item-card" @click="go(urls.compDetail(c.id))">
              <div class="vue-card-title"><a :href="urls.compDetail(c.id)" @click.prevent>{{ c.title }}</a></div>
              <div class="vue-meta">
                <el-tag size="small" type="primary">{{ c.subject || '综合' }}</el-tag>
                <el-tag size="small" :type="c.mode === 'team' ? 'warning' : 'info'">{{ c.mode === 'team' ? '团队赛' : '个人赛' }}</el-tag>
                <span>{{ c.eval_mode === 'manual' ? '人工评测' : '自动评测' }}</span>
              </div>
              <div class="vue-meta">
                <span>👤 {{ c.publisher_name }}</span>
                <span>🙋 已报名 {{ c.signup_count }} 人</span>
              </div>
              <div class="vue-card-footer">
                <span class="vue-prize">{{ money(c.prize_amount) }}</span>
                <el-button type="primary" size="small" @click.stop="go(urls.compDetail(c.id))">查看详情</el-button>
              </div>
            </el-card>
          </el-col>
        </el-row>
        <el-empty v-else description="暂无进行中的竞赛，会员用户可发布第一场竞赛"></el-empty>

        <div class="vue-section-head" style="margin-top:26px">
          <h2>💰 高额悬赏</h2>
          <a :href="urls.bountyList" class="muted">进入悬赏广场 →</a>
        </div>
        <el-row :gutter="16" v-if="hotBounties.length">
          <el-col :xs="24" :sm="12" :md="8" v-for="b in hotBounties" :key="b.id" style="margin-bottom:16px">
            <el-card shadow="hover" class="vue-item-card" @click="go(urls.bountyDetail(b.id))">
              <div class="vue-card-title"><a :href="urls.bountyDetail(b.id)" @click.prevent>{{ b.title }}</a></div>
              <div class="vue-meta">
                <el-tag size="small" type="success">{{ b.subject || '通用' }}</el-tag>
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
        <el-empty v-else description="暂无待解决的悬赏，会员用户可发布悬赏求助"></el-empty>
      </div>
    `
  });
})();
