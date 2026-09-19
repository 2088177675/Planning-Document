/* 竞赛详情 Vue 应用：报名/组队/采纳用动态 form POST 到 Flask */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;
  var COMP = window.__COMP_STATUS__;

  window.__bootVueApp({
    data: function () {
      return {
        c: data.c || {},
        materials: data.materials || [],
        announcements: data.announcements || [],
        questions: data.questions || [],
        teams: data.teams || [],
        signupCount: data.signupCount || 0,
        mine: data.mine || null,
        myTeam: data.myTeam || null,
        board: data.board || [],
        champion: data.champion || null,
        championTeam: data.championTeam || null,
        canSignup: !!data.canSignup,
        phase: data.phase || '',
        now: data.now || '',
        user: window.__USER__,
        urls: U,
        teamDialog: false,
        newTeamName: ''
      };
    },
    computed: {
      isPublisher: function () {
        return this.user && this.c.publisher_id && this.user.id === this.c.publisher_id;
      },
      isAdmin: function () { return this.user && this.user.role === 'admin'; },
      canManage: function () { return this.isPublisher || this.isAdmin; },
      statusInfo: function () { return (window.__COMP_STATUS__ || {})[this.c.status] || { label: this.c.status, type: 'info' }; },
      isTeamMode: function () { return this.c.mode === 'team'; },
      hasSubmitted: function () { return this.mine !== null; },
      inSubmitWindow: function () {
        if (this.c.status !== 'open') return false;
        if (this.c.submit_deadline && this.now > this.c.submit_deadline) return false;
        return true;
      },
      materialDownloadUrl: function () {
        var cid = this.c.id;
        return function (mid) { return '/competitions/' + cid + '/material/' + mid + '/download'; };
      }
    },
    methods: {
      go: function (url) { window.location.href = url; },
      money: function (n) { return '¥' + Number(n || 0).toFixed(2); },
      shortTime: function (s) { return s ? String(s).slice(5, 16).replace('T', ' ') : '—'; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      postForm: function (action, fields) {
        var f = document.createElement('form');
        f.method = 'POST';
        f.action = action;
        f.style.display = 'none';
        Object.keys(fields || {}).forEach(function (k) {
          var i = document.createElement('input');
          i.type = 'hidden'; i.name = k; i.value = fields[k];
          f.appendChild(i);
        });
        document.body.appendChild(f);
        f.submit();
      },
      doSignup: function () {
        this.postForm('/competitions/' + this.c.id + '/signup', {});
      },
      openTeamDialog: function () { this.teamDialog = true; this.newTeamName = ''; },
      doCreateTeam: function () {
        if (!this.newTeamName.trim()) {
          this.$msg && this.$msg.warning('请填写队伍名称');
          return;
        }
        this.postForm('/competitions/' + this.c.id + '/team/create', { team_name: this.newTeamName.trim() });
      },
      doJoinTeam: function (tid) {
        this.postForm('/competitions/' + this.c.id + '/team/' + tid + '/join', {});
      },
      goSubmit: function () { window.location.href = '/competitions/' + this.c.id + '/submit'; },
      goManage: function () { window.location.href = '/competitions/' + this.c.id + '/manage'; }
    },
    template: `
      <div class="page-vue">
        <div class="muted" style="margin-bottom:12px"><a :href="urls.compList">← 返回竞赛广场</a></div>

        <el-card shadow="never" class="vue-detail-head">
          <div class="vue-card-title" style="font-size:22px">{{ c.title }}</div>
          <div class="vue-meta" style="margin-bottom:10px">
            <el-tag size="default" type="primary">{{ c.subject || '综合' }}</el-tag>
            <el-tag size="default" :type="isTeamMode ? 'warning' : 'info'">{{ isTeamMode ? '团队赛' : '个人赛' }}</el-tag>
            <el-tag size="default" :type="c.eval_mode === 'manual' ? 'info' : 'success'">{{ c.eval_mode === 'manual' ? '人工评测' : '自动评测' }}</el-tag>
            <el-tag v-if="c.difficulty" size="default" type="info" effect="plain">{{ c.difficulty }}</el-tag>
            <el-tag size="default" :type="statusInfo.type">{{ phase }}</el-tag>
          </div>
          <div class="vue-meta">
            <span>👤 发布者 {{ c.publisher_name }}</span>
            <span>🙋 已报名 {{ signupCount }} 人</span>
            <span v-if="c.participant_limit">📋 上限 {{ c.participant_limit }} 人</span>
            <span v-if="isTeamMode">👥 队伍上限 {{ c.team_count_max || '不限' }} 支，每队 {{ c.team_size_max }} 人</span>
          </div>
          <div class="vue-meta">
            <span>📅 报名：{{ shortTime(c.signup_start) }} ~ {{ shortTime(c.signup_end) }}</span>
            <span>📝 作答：{{ shortTime(c.contest_start) }} ~ {{ shortTime(c.submit_deadline) }}</span>
            <span v-if="c.result_time">🏆 公布：{{ shortTime(c.result_time) }}</span>
          </div>
        </el-card>

        <el-row :gutter="16" style="margin-top:16px">
          <el-col :xs="24" :md="16">
            <el-card shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">奖金</div>
              <div class="vue-prize" style="font-size:30px">{{ money(c.prize_amount) }}</div>
              <div class="muted" style="font-size:13px">发布时已全额托管，冠军独享，平台零分成</div>
            </el-card>

            <el-card v-if="c.intro" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">竞赛简介</div>
              <div style="line-height:1.7;color:#334155">{{ c.intro }}</div>
            </el-card>

            <el-card v-if="c.background" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">背景说明</div>
              <div style="line-height:1.7;color:#334155;white-space:pre-wrap">{{ c.background }}</div>
            </el-card>

            <el-card v-if="c.audience" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">面向对象</div>
              <div style="color:#334155">{{ c.audience }}</div>
            </el-card>

            <el-card v-if="materials.length" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">竞赛资料（{{ materials.length }}）</div>
              <div v-for="m in materials" :key="m.id" class="vue-info-list">
                <div>
                  <div style="font-weight:600">{{ m.kind || '未分类资料' }}</div>
                  <div class="muted" style="font-size:12px">{{ m.filename }}</div>
                </div>
                <el-button size="small" type="primary" plain @click="go(materialDownloadUrl(m.id))">下载</el-button>
              </div>
            </el-card>

            <el-card v-if="announcements.length" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">赛事公告（{{ announcements.length }}）</div>
              <div v-for="a in announcements" :key="a.id" class="vue-announce">
                <div class="muted" style="font-size:12px">{{ shortTime(a.created_at) }}</div>
                <div style="color:#334155;margin-top:4px">{{ a.content }}</div>
              </div>
            </el-card>

            <el-card v-if="questions.length" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">客观题（自动评测，{{ questions.length }} 题）</div>
              <div v-for="qq in questions" :key="qq.id" class="vue-q-box">
                <div><span class="muted">第 {{ qq.qno }} 题 · {{ qq.score }} 分</span></div>
                <div style="color:#334155;margin-top:4px">{{ qq.content }}</div>
              </div>
            </el-card>

            <el-card v-if="isTeamMode && teams.length" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">参赛队伍（{{ teams.length }}）</div>
              <div v-for="t in teams" :key="t.id" class="vue-info-list">
                <div>
                  <div style="font-weight:600">{{ t.name }}</div>
                  <div class="muted" style="font-size:12px">队长 {{ t.leader_name }} · {{ t.member_count }} 人</div>
                </div>
                <el-button v-if="canSignup && !hasSubmitted" size="small" type="success" @click="doJoinTeam(t.id)">加入队伍</el-button>
                <el-tag v-else-if="myTeam && myTeam.id === t.id" size="small" type="success">我的队伍</el-tag>
              </div>
            </el-card>

            <el-card v-if="board.length" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">实时榜单（{{ board.length }}）</div>
              <el-table :data="board" size="small" style="width:100%">
                <el-table-column type="index" label="排名" width="70" :index="i => i + 1"></el-table-column>
                <el-table-column label="参赛者">
                  <template #default="scope">
                    <span v-if="scope.row.team_name">👥 {{ scope.row.team_name }}</span>
                    <span v-else>{{ scope.row.real_name || scope.row.username }}</span>
                  </template>
                </el-table-column>
                <el-table-column label="分数" width="120">
                  <template #default="scope">
                    <span v-if="scope.row.score !== null" style="font-weight:700;color:#dc2626">{{ scope.row.score }}</span>
                    <span v-else class="muted">未评分</span>
                  </template>
                </el-table-column>
                <el-table-column label="提交时间" width="160">
                  <template #default="scope">{{ shortTime(scope.row.submitted_at) }}</template>
                </el-table-column>
              </el-table>
            </el-card>
          </el-col>

          <el-col :xs="24" :md="8">
            <el-card shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">操作</div>
              <div v-if="!user" class="muted" style="margin-bottom:10px">请先登录后再操作</div>
              <template v-else>
                <div v-if="canManage" style="margin-bottom:10px">
                  <el-button type="warning" plain style="width:100%" @click="goManage">进入赛事后台</el-button>
                </div>
                <div v-if="canSignup && !isTeamMode" style="margin-bottom:10px">
                  <el-button type="primary" style="width:100%" @click="doSignup">立即报名</el-button>
                </div>
                <div v-else-if="canSignup && isTeamMode" style="margin-bottom:10px">
                  <el-button type="primary" style="width:100%;margin-bottom:8px" @click="openTeamDialog">创建新队伍</el-button>
                  <div class="muted" style="font-size:12px">或下方选择已有队伍加入</div>
                </div>
                <div v-else-if="hasSubmitted && inSubmitWindow" style="margin-bottom:10px">
                  <el-button type="success" style="width:100%" @click="goSubmit">提交 / 修改作品</el-button>
                  <div v-if="myTeam" class="muted" style="font-size:12px;margin-top:6px">所在队伍：{{ myTeam.name }}</div>
                </div>
                <div v-else-if="hasSubmitted" class="muted" style="margin-bottom:10px;font-size:13px">已报名，作品提交已截止</div>
                <div v-else-if="c.status !== 'open'" class="muted" style="margin-bottom:10px;font-size:13px">竞赛当前不在进行中</div>
                <div v-else class="muted" style="margin-bottom:10px;font-size:13px">报名已截止或名额已满</div>
              </template>
            </el-card>

            <el-card v-if="champion" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">🏆 冠军</div>
              <div v-if="championTeam" style="margin-bottom:6px"><el-tag type="warning">队伍 {{ championTeam.name }}</el-tag></div>
              <div style="font-size:18px;font-weight:700;color:#dc2626">{{ champion.real_name || champion.username }}</div>
              <div class="muted" style="font-size:13px">奖金 {{ money(c.prize_amount) }} 已发放</div>
            </el-card>

            <el-card v-if="c.reject_reason" shadow="never">
              <div class="vue-section-title">驳回原因</div>
              <div style="color:#b91c1c">{{ c.reject_reason }}</div>
            </el-card>
          </el-col>
        </el-row>

        <el-dialog v-model="teamDialog" title="创建新队伍" width="420px">
          <el-input v-model="newTeamName" placeholder="请输入队伍名称" size="large" @keyup.enter="doCreateTeam"></el-input>
          <template #footer>
            <el-button @click="teamDialog = false">取消</el-button>
            <el-button type="primary" @click="doCreateTeam">创建并成为队长</el-button>
          </template>
        </el-dialog>
      </div>
    `
  });
})();
