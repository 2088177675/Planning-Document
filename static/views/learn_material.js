/* 资料详情 + AI 沉浸式助学侧栏 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        m: data.m || {},
        author: data.author || {},
        isOwner: data.isOwner,
        conversations: data.conversations || [],
        isFav: data.isFav,
        isFollowing: data.isFollowing,
        myFolders: data.myFolders || [],
        kindLabels: data.kindLabels || {},
        difficultyLabels: data.difficultyLabels || {},
        isLoggedIn: data.isLoggedIn,
        user: window.__USER__,
        urls: U,
        // 编辑模式
        editMode: false,
        editForm: { title: '', content: '', subject: '', difficulty: '', folder_id: null, is_public: false },
        saving: false,
        // AI 助学
        chatOpen: false,
        chatInput: '',
        chatting: false,
        // 举报
        reportVisible: false,
        reportReason: '',
        reporting: false
      };
    },
    created: function () {
      this.editForm = {
        title: this.m.title,
        content: this.m.content,
        subject: this.m.subject,
        difficulty: this.m.difficulty,
        folder_id: this.m.folder_id,
        is_public: !!this.m.is_public
      };
    },
    methods: {
      go: function (url) { window.location.href = url; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      kindTag: function (k) { return this.kindLabels[k] || k; },
      diffTag: function (d) { return this.difficultyLabels[d] || d; },
      renderMd: function (text) { return window.__renderMarkdown ? window.__renderMarkdown(text) : (text || ''); },
      startEdit: function () { this.editMode = true; },
      cancelEdit: function () { this.editMode = false; },
      saveEdit: function () {
        var self = this;
        this.saving = true;
        fetch(U.learnMaterialUpdate(this.m.id), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.editForm)
        }).then(function (r) { return r.json(); }).then(function (res) {
          self.saving = false;
          if (!res.ok) { self.$msg.error(res.msg || '保存失败'); return; }
          self.m.title = self.editForm.title;
          self.m.content = self.editForm.content;
          self.m.subject = self.editForm.subject;
          self.m.difficulty = self.editForm.difficulty;
          self.m.folder_id = self.editForm.folder_id;
          self.m.is_public = self.editForm.is_public ? 1 : 0;
          self.editMode = false;
          self.$msg.success('已保存');
        }).catch(function (e) { self.saving = false; self.$msg.error('网络异常'); });
      },
      removeMaterial: function () {
        var self = this;
        this.$confirm('确认删除该资料？', '删除确认', { type: 'warning' }).then(function () {
          var f = document.createElement('form');
          f.method = 'POST'; f.action = U.learnMaterialDelete(self.m.id);
          document.body.appendChild(f); f.submit();
        }).catch(function () {});
      },
      togglePublic: function () {
        var self = this;
        fetch(U.learnMaterialTogglePublic(this.m.id), { method: 'POST' })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (!res.ok) { self.$msg.error(res.msg || '操作失败'); return; }
            self.m.is_public = res.is_public ? 1 : 0;
            self.editForm.is_public = !!res.is_public;
            self.$msg.success(res.is_public ? '已设为公开' : '已设为私有');
          });
      },
      favorite: function () {
        var self = this;
        if (!this.isLoggedIn) { this.$msg.warning('请先登录'); return; }
        fetch(U.learnMaterialFavorite(this.m.id), { method: 'POST' })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (!res.ok) { self.$msg.error(res.msg || '操作失败'); return; }
            self.isFav = res.favorited;
            self.$msg.success(res.favorited ? '已收藏到资料库' : '已取消收藏');
          });
      },
      follow: function () {
        var self = this;
        if (!this.isLoggedIn) { this.$msg.warning('请先登录'); return; }
        fetch(U.learnFollow(this.author.id), { method: 'POST' })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            if (!res.ok) { self.$msg.error(res.msg || '操作失败'); return; }
            self.isFollowing = res.following;
            self.$msg.success(res.msg || (res.following ? '已关注' : '已取消关注'));
          });
      },
      // AI 助学
      openChat: function () {
        if (!this.isLoggedIn) { this.$msg.warning('请先登录后使用 AI 助学'); return; }
        this.chatOpen = true;
      },
      sendChat: function () {
        var self = this;
        if (!this.chatInput.trim()) return;
        var q = this.chatInput;
        this.conversations.push({ role: 'user', content: q });
        this.chatInput = '';
        this.chatting = true;
        fetch(U.learnMaterialAssist(this.m.id), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ question: q })
        }).then(function (r) { return r.json(); }).then(function (res) {
          self.chatting = false;
          if (!res.ok) { self.$msg.error(res.msg || 'AI 调用失败'); return; }
          self.conversations.push({ role: 'assistant', content: res.answer });
          self.$nextTick(function () {
            var box = self.$el.querySelector('.learn-chat-messages');
            if (box) box.scrollTop = box.scrollHeight;
          });
        }).catch(function (e) { self.chatting = false; self.$msg.error('网络异常'); });
      },
      // 举报
      openReport: function () {
        if (!this.isLoggedIn) { this.$msg.warning('请先登录后举报'); return; }
        this.reportVisible = true;
      },
      submitReport: function () {
        var self = this;
        if (!this.reportReason.trim()) { this.$msg.warning('请填写举报理由'); return; }
        this.reporting = true;
        fetch(U.learnMaterialReport(this.m.id), {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: this.reportReason })
        }).then(function (r) { return r.json(); }).then(function (res) {
          self.reporting = false;
          if (!res.ok) { self.$msg.error(res.msg || '举报失败'); return; }
          self.reportVisible = false;
          self.reportReason = '';
          self.$msg.success(res.msg || '举报已提交');
        }).catch(function (e) { self.reporting = false; self.$msg.error('网络异常'); });
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-detail-head">
          <div>
            <h1>{{ m.title }}</h1>
            <div class="vue-meta">
              <el-tag size="small" type="primary">{{ kindTag(m.kind) }}</el-tag>
              <el-tag v-if="m.difficulty" size="small" type="warning">{{ diffTag(m.difficulty) }}</el-tag>
              <el-tag v-if="m.subject" size="small" type="info">{{ m.subject }}</el-tag>
              <el-tag v-if="m.is_public" size="small" type="success">公开</el-tag>
              <el-tag v-else size="small" type="info">私有</el-tag>
              <span>👀 {{ m.views }} 浏览</span>
              <span>更新：{{ fullTime(m.updated_at) }}</span>
            </div>
          </div>
          <div>
            <el-button type="primary" @click="openChat">💬 AI 助学</el-button>
            <template v-if="isLoggedIn">
              <el-button v-if="!isOwner" :type="isFollowing ? 'success' : 'primary'" plain @click="follow">
                {{ isFollowing ? '已关注' : '+ 关注作者' }}
              </el-button>
              <el-button v-if="!isOwner && m.is_public" :type="isFav ? 'warning' : 'primary'" plain @click="favorite">
                {{ isFav ? '已收藏' : '⭐ 收藏' }}
              </el-button>
              <el-button v-if="!isOwner && m.is_public" type="danger" plain @click="openReport">🚩 举报</el-button>
              <a :href="urls.learnUser(author.id)" style="margin-left:8px">作者：{{ author.real_name || author.username }}</a>
            </template>
          </div>
        </div>

        <!-- 编辑模式 -->
        <el-card v-if="editMode" shadow="never" style="margin-bottom:16px">
          <div class="vue-section-title">编辑资料</div>
          <el-form label-position="top">
            <el-form-item label="标题">
              <el-input v-model="editForm.title"></el-input>
            </el-form-item>
            <el-row :gutter="12">
              <el-col :xs="12" :sm="6">
                <el-form-item label="学科"><el-input v-model="editForm.subject"></el-input></el-form-item>
              </el-col>
              <el-col :xs="12" :sm="6">
                <el-form-item label="难度">
                  <el-select v-model="editForm.difficulty" style="width:100%">
                    <el-option v-for="(lbl, k) in difficultyLabels" :key="k" :label="lbl" :value="k"></el-option>
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="12" :sm="6">
                <el-form-item label="归档文件夹">
                  <el-select v-model="editForm.folder_id" clearable style="width:100%">
                    <el-option v-for="f in myFolders" :key="f.id" :label="f.name" :value="f.id"></el-option>
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="12" :sm="6">
                <el-form-item label="公开共享">
                  <el-switch v-model="editForm.is_public" active-text="公开" inactive-text="私有"></el-switch>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="内容（Markdown）">
              <el-input v-model="editForm.content" type="textarea" :rows="18" placeholder="支持 Markdown"></el-input>
            </el-form-item>
            <div>
              <el-button type="primary" :loading="saving" @click="saveEdit">保存</el-button>
              <el-button @click="cancelEdit">取消</el-button>
            </div>
          </el-form>
        </el-card>

        <!-- 浏览模式 -->
        <el-card v-else shadow="never" style="margin-bottom:16px">
          <div class="learn-md-preview" v-html="renderMd(m.content)"></div>
          <div v-if="isOwner" style="margin-top:16px;border-top:1px dashed #e5e7eb;padding-top:12px">
            <el-button size="small" type="primary" @click="startEdit">编辑</el-button>
            <el-button size="small" :type="m.is_public ? 'warning' : 'success'" plain @click="togglePublic">
              {{ m.is_public ? '设为私有' : '设为公开' }}
            </el-button>
            <el-button size="small" type="danger" @click="removeMaterial">删除</el-button>
          </div>
        </el-card>

        <!-- AI 助学抽屉 -->
        <el-drawer v-model="chatOpen" title="💬 AI 实时助学" direction="rtl" size="42%" class="learn-chat-drawer">
          <div class="learn-chat-messages" v-if="conversations.length">
            <div v-for="(c, i) in conversations" :key="i"
                 :class="['learn-chat-bubble', c.role]">
              <div class="role">{{ c.role === 'user' ? '我' : 'AI 助学' }}</div>
              <div v-if="c.role === 'assistant'" v-html="renderMd(c.content)"></div>
              <div v-else>{{ c.content }}</div>
            </div>
          </div>
          <el-empty v-else description="还没有对话，向 AI 提问吧" :image-size="80"></el-empty>
          <div class="learn-chat-input">
            <el-input v-model="chatInput" type="textarea" :rows="3" placeholder="基于当前资料提问：知识点答疑 / 出题 / 总结 / 通俗化讲解…" @keydown.enter.ctrl="sendChat"></el-input>
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:8px">
              <span class="muted" style="font-size:12px">Ctrl+Enter 发送 · AI 严格依据当前资料作答</span>
              <el-button type="primary" :loading="chatting" @click="sendChat">发送</el-button>
            </div>
          </div>
        </el-drawer>

        <!-- 举报弹窗 -->
        <el-dialog v-model="reportVisible" title="🚩 举报违规资料" width="480px">
          <el-input v-model="reportReason" type="textarea" :rows="4"
            placeholder="请描述违规原因，例如：含违法违规内容 / 抄袭 / 不实信息等"></el-input>
          <template #footer>
            <el-button @click="reportVisible = false">取消</el-button>
            <el-button type="danger" :loading="reporting" @click="submitReport">提交举报</el-button>
          </template>
        </el-dialog>
      </div>
    `
  });
})();
