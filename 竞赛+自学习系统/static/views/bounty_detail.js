/* 悬赏详情 Vue 应用：提交解答用原生 form（含文件上传），采纳用动态 form POST */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;
  var BOUNTY = window.__BOUNTY_STATUS__;

  window.__bootVueApp({
    data: function () {
      return {
        b: data.b || {},
        attachments: data.attachments || [],
        answers: data.answers || [],
        adopted: data.adopted || null,
        myAnswer: data.myAnswer || null,
        canAnswer: !!data.canAnswer,
        isPublisher: !!data.isPublisher,
        now: data.now || '',
        user: window.__USER__,
        urls: U,
        answerForm: { content: '' }
      };
    },
    computed: {
      statusInfo: function () { return (window.__BOUNTY_STATUS__ || {})[this.b.status] || { label: this.b.status, type: 'info' }; },
      answerUrl: function () { return '/bounties/' + this.b.id + '/answer'; },
      attachmentUrl: function () {
        var bid = this.b.id;
        return function (aid) { return '/bounties/' + bid + '/attachment/' + aid + '/download'; };
      },
      answerFileUrl: function () {
        var bid = this.b.id;
        return function (ansId) { return '/bounties/' + bid + '/answer-file/' + ansId + '/download'; };
      }
    },
    methods: {
      go: function (url) { window.location.href = url; },
      money: function (n) { return '¥' + Number(n || 0).toFixed(2); },
      shortTime: function (s) { return s ? String(s).slice(5, 16).replace('T', ' ') : '—'; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      isAdopted: function (a) { return this.adopted && this.adopted.id === a.id; },
      isMyAnswer: function (a) { return this.user && a.user_id === this.user.id; },
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
      doAdopt: function (aid) {
        var self = this;
        this.$confirm('确认采纳该解答？采纳后赏金 ' + this.money(this.b.bounty_amount) +
                      ' 将立即发放给解答者，且不可撤销。', '采纳确认', {
          type: 'warning', confirmButtonText: '确认采纳', cancelButtonText: '取消'
        }).then(function () {
          self.postForm('/bounties/' + self.b.id + '/adopt/' + aid, {});
        }).catch(function () {});
      },
      submitAnswer: function () {
        if (!this.answerForm.content.trim()) {
          this.$msg && this.$msg.warning('请填写解答内容');
          return false;
        }
        return true;
      }
    },
    template: `
      <div class="page-vue">
        <div class="muted" style="margin-bottom:12px"><a :href="urls.bountyList">← 返回悬赏广场</a></div>

        <el-card shadow="never" class="vue-detail-head">
          <div class="vue-card-title" style="font-size:22px">{{ b.title }}</div>
          <div class="vue-meta" style="margin-bottom:10px">
            <el-tag size="default" type="success">{{ b.subject || '通用' }}</el-tag>
            <el-tag v-if="b.tags" size="default" type="info" effect="plain">{{ b.tags }}</el-tag>
            <el-tag size="default" :type="statusInfo.type">{{ statusInfo.label }}</el-tag>
          </div>
          <div class="vue-meta">
            <span>👤 发布者 {{ b.publisher_name }}</span>
            <span>💬 {{ answers.length }} 人解答</span>
            <span>⏰ 截止 {{ fullTime(b.expire_at) }}</span>
          </div>
        </el-card>

        <el-row :gutter="16" style="margin-top:16px">
          <el-col :xs="24" :md="16">
            <el-card shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">赏金</div>
              <div class="vue-prize" style="font-size:30px">{{ money(b.bounty_amount) }}</div>
              <div class="muted" style="font-size:13px">发布时已全额托管，被采纳即获全额赏金，平台零分成</div>
            </el-card>

            <el-card shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">问题内容</div>
              <div style="line-height:1.7;color:#334155;white-space:pre-wrap">{{ b.content }}</div>
            </el-card>

            <el-card v-if="attachments.length" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">附件（{{ attachments.length }}）</div>
              <div v-for="a in attachments" :key="a.id" class="vue-info-list">
                <div>
                  <div style="font-weight:600">{{ a.filename }}</div>
                  <div class="muted" style="font-size:12px">{{ shortTime(a.created_at) }}</div>
                </div>
                <el-button size="small" type="primary" plain @click="go(attachmentUrl(a.id))">下载</el-button>
              </div>
            </el-card>

            <el-card v-if="answers.length" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">全部解答（{{ answers.length }}）</div>
              <div v-for="a in answers" :key="a.id" class="vue-q-box" :style="isAdopted(a) ? 'border:1px solid #16a34a;background:#f0fdf4' : ''">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px">
                  <div>
                    <span style="font-weight:700">{{ a.real_name || a.username }}</span>
                    <el-tag v-if="isAdopted(a)" size="small" type="success" style="margin-left:8px">已采纳</el-tag>
                    <el-tag v-else-if="a.status === 'pending'" size="small" type="info" style="margin-left:8px">待采纳</el-tag>
                  </div>
                  <span class="muted" style="font-size:12px">{{ fullTime(a.submitted_at) }}</span>
                </div>
                <div style="color:#334155;line-height:1.7;white-space:pre-wrap">{{ a.content }}</div>
                <div v-if="a.filename" style="margin-top:8px">
                  <el-button size="small" type="info" plain @click="go(answerFileUrl(a.id))">📎 {{ a.filename }}</el-button>
                </div>
                <div v-if="isPublisher && !isAdopted(a) && b.status === 'open'" style="margin-top:10px">
                  <el-button type="success" size="small" @click="doAdopt(a.id)">采纳此解答</el-button>
                </div>
              </div>
            </el-card>

            <el-card v-if="canAnswer" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">{{ myAnswer ? '更新我的解答' : '提交解答' }}</div>
              <form :action="answerUrl" method="POST" enctype="multipart/form-data" @submit="submitAnswer">
                <el-input v-model="answerForm.content" name="content" type="textarea" :rows="6"
                          placeholder="详细描述你的解答思路、方法与结论（必填）"></el-input>
                <div style="margin-top:10px">
                  <label class="muted" style="font-size:13px;display:block;margin-bottom:4px">附件（可选，支持代码/图片/文档）</label>
                  <input type="file" name="answer_file" class="el-input__inner" style="padding:6px">
                </div>
                <div style="margin-top:14px">
                  <el-button type="success" native-type="submit">{{ myAnswer ? '更新解答' : '提交解答' }}</el-button>
                </div>
              </form>
            </el-card>
          </el-col>

          <el-col :xs="24" :md="8">
            <el-card v-if="adopted" shadow="never" style="margin-bottom:16px">
              <div class="vue-section-title">✅ 已采纳解答</div>
              <div style="font-size:18px;font-weight:700;color:#16a34a">{{ adopted.real_name || adopted.username }}</div>
              <div class="muted" style="font-size:13px">赏金 {{ money(b.bounty_amount) }} 已发放</div>
            </el-card>

            <el-card shadow="never">
              <div class="vue-section-title">悬赏须知</div>
              <ul style="margin:0;padding-left:18px;color:#475569;line-height:1.8;font-size:13px">
                <li>所有用户均可免费提交解答</li>
                <li>发布者不可解答自己发布的悬赏</li>
                <li>发布者可采纳任一解答，采纳即发奖</li>
                <li>到期无采纳自动过期、赏金原路退回</li>
              </ul>
            </el-card>
          </el-col>
        </el-row>
      </div>
    `
  });
})();
