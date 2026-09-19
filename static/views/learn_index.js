/* 自学习平台首页 + AI 知识点生成 */
(function () {
  var data = window.__PAGE_DATA__ || {};
  var U = window.__URLS__;

  window.__bootVueApp({
    data: function () {
      return {
        myRecent: data.myRecent || [],
        publicHot: data.publicHot || [],
        kindLabels: data.kindLabels || {},
        difficultyLabels: data.difficultyLabels || {},
        isLogged: data.isLogged,
        user: window.__USER__,
        urls: U,
        // AI 生成表单
        form: {
          prompt: '',
          kind: 'auto',
          subject: '',
          difficulty: 'normal'
        },
        kinds: [
          { value: 'auto', label: '智能判断（推荐）' },
          { value: 'ai_video_script', label: '视频讲解脚本素材包' },
          { value: 'ai_mindmap', label: '思维导图 + 学习讲义' },
          { value: 'ai_doc', label: '学习讲义（纯文档）' },
          { value: 'ai_summary', label: '知识点总结' },
          { value: 'ai_quiz', label: '练习题' }
        ],
        difficulties: [
          { value: 'easy', label: '入门易懂' },
          { value: 'normal', label: '常规学习' },
          { value: 'hard', label: '考试冲刺' }
        ],
        generating: false,
        generated: null, // {kind, content, kindLabel, remaining, limit}
        saveTitle: '',
        savePublic: false,
        saveFolder: null,
        saving: false
      };
    },
    computed: {
      canSave: function () { return !!this.generated && !this.saving; }
    },
    methods: {
      go: function (url) { window.location.href = url; },
      fullTime: function (s) { return s ? String(s).replace('T', ' ').slice(0, 16) : '—'; },
      kindTag: function (k) { return this.kindLabels[k] || k; },
      renderMarkdown: function (text) { return window.__renderMarkdown ? window.__renderMarkdown(text) : (text || ''); },
      doGenerate: function () {
        var self = this;
        if (!this.isLogged) {
          this.$msg.warning('请先登录后再使用 AI 生成');
          setTimeout(function () { window.location.href = U.login + '?next=' + encodeURIComponent(U.learnIndex); }, 800);
          return;
        }
        if (!this.form.prompt.trim()) {
          this.$msg.warning('请输入知识点提示词');
          return;
        }
        this.generating = true;
        this.generated = null;
        fetch(U.learnAiGenerate, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(this.form)
        }).then(function (r) { return r.json(); }).then(function (res) {
          self.generating = false;
          if (!res.ok) {
            self.$msg.error(res.msg || '生成失败');
            if (res.remaining !== undefined) {
              self.$msg.info('今日剩余次数：' + Math.max(0, res.remaining) + ' / ' + (res.limit || 30));
            }
            return;
          }
          self.generated = {
            kind: res.kind,
            kindLabel: res.kind_label || self.kindLabels[res.kind] || res.kind,
            content: res.content,
            remaining: res.remaining,
            limit: res.limit
          };
          // 默认标题取提示词的前 24 字
          self.saveTitle = self.form.prompt.slice(0, 24);
          self.$msg.success('生成成功，剩余 ' + res.remaining + ' / ' + res.limit + ' 次');
        }).catch(function (err) {
          self.generating = false;
          self.$msg.error('网络异常：' + err);
        });
      },
      doSave: function () {
        var self = this;
        if (!this.saveTitle.trim()) { this.$msg.warning('请填写资料标题'); return; }
        this.saving = true;
        fetch(U.learnMaterialSave, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: this.saveTitle,
            kind: this.generated.kind,
            content: this.generated.content,
            subject: this.form.subject,
            difficulty: this.form.difficulty,
            folder_id: this.saveFolder,
            is_public: this.savePublic ? 1 : 0
          })
        }).then(function (r) { return r.json(); }).then(function (res) {
          self.saving = false;
          if (!res.ok) { self.$msg.error(res.msg || '保存失败'); return; }
          self.$msg.success('已保存到个人资料库');
          setTimeout(function () { window.location.href = res.redirect; }, 700);
        }).catch(function (err) {
          self.saving = false;
          self.$msg.error('网络异常：' + err);
        });
      },
      discard: function () {
        this.generated = null;
        this.saveTitle = '';
      }
    },
    template: `
      <div class="page-vue">
        <div class="vue-hero-row">
          <div>
            <h1 class="vue-page-title" style="margin:0">📚 AI 自学习平台</h1>
            <div class="vue-page-sub">输入知识点提示词，AI 智能判断体量自动生成学习资料：零散概念自动生成视频脚本素材包，
              体系化知识自动生成思维导图与学习讲义。师生全免费使用。</div>
          </div>
        </div>

        <el-card shadow="never" style="margin-bottom:16px;border-left:4px solid #2563eb">
          <div class="vue-section-title">✨ AI 知识点智能生成</div>
          <el-form label-position="top" size="default">
            <el-form-item label="知识点提示词 / 范围描述">
              <el-input v-model="form.prompt" type="textarea" :rows="4"
                placeholder="例如：傅里叶变换的物理意义；或：计算机网络第一章 概述体系结构" maxlength="500" show-word-limit></el-input>
            </el-form-item>
            <el-row :gutter="12">
              <el-col :xs="24" :sm="8">
                <el-form-item label="输出类型">
                  <el-select v-model="form.kind" style="width:100%">
                    <el-option v-for="k in kinds" :key="k.value" :label="k.label" :value="k.value"></el-option>
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="12" :sm="6">
                <el-form-item label="学科（可选）">
                  <el-input v-model="form.subject" placeholder="如：高等数学"></el-input>
                </el-form-item>
              </el-col>
              <el-col :xs="12" :sm="6">
                <el-form-item label="难度">
                  <el-select v-model="form.difficulty" style="width:100%">
                    <el-option v-for="d in difficulties" :key="d.value" :label="d.label" :value="d.value"></el-option>
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :xs="24" :sm="4" style="display:flex;align-items:flex-end">
                <el-button type="primary" :loading="generating" @click="doGenerate" style="width:100%">
                  {{ generating ? 'AI 生成中…' : '🚀 开始生成' }}
                </el-button>
              </el-col>
            </el-row>
          </el-form>
        </el-card>

        <el-card v-if="generated" shadow="never" style="margin-bottom:16px;border-left:4px solid #16a34a">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <div class="vue-section-title" style="margin:0">📝 生成结果 · {{ generated.kindLabel }}</div>
            <div class="muted" style="font-size:13px">今日剩余 {{ generated.remaining }} / {{ generated.limit }} 次</div>
          </div>
          <div class="learn-md-preview" v-html="renderMarkdown(generated.content)"></div>

          <el-divider content-position="left">保存到个人资料库</el-divider>
          <el-form label-position="top" size="default">
            <el-row :gutter="12">
              <el-col :xs="24" :sm="14">
                <el-form-item label="资料标题">
                  <el-input v-model="saveTitle" placeholder="为这份学习资料命名"></el-input>
                </el-form-item>
              </el-col>
              <el-col :xs="12" :sm="5">
                <el-form-item label="是否公开">
                  <el-switch v-model="savePublic" active-text="公开共享" inactive-text="私有"></el-switch>
                </el-form-item>
              </el-col>
              <el-col :xs="12" :sm="5" style="display:flex;align-items:flex-end">
                <div>
                  <el-button type="success" :loading="saving" :disabled="!canSave" @click="doSave">💾 保存</el-button>
                  <el-button @click="discard">放弃</el-button>
                </div>
              </el-col>
            </el-row>
          </el-form>
        </el-card>

        <el-row :gutter="16">
          <el-col :xs="24" :md="12" v-if="isLogged">
            <div class="vue-section-head">
              <h2>📘 我的最近资料</h2>
              <a :href="urls.learnLibrary" class="muted">进入资料库 →</a>
            </div>
            <el-empty v-if="!myRecent.length" description="还没有 AI 生成或上传的资料，立刻生成一份吧"></el-empty>
            <el-row :gutter="12" v-else>
              <el-col :xs="24" :sm="12" v-for="m in myRecent" :key="m.id" style="margin-bottom:12px">
                <el-card shadow="hover" class="vue-item-card" @click="go(urls.learnMaterial(m.id))">
                  <div class="vue-card-title">{{ m.title }}</div>
                  <div class="vue-meta">
                    <el-tag size="small" type="primary">{{ kindTag(m.kind) }}</el-tag>
                    <el-tag v-if="m.is_public" size="small" type="success">已公开</el-tag>
                    <span>{{ fullTime(m.updated_at) }}</span>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </el-col>
          <el-col :xs="24" :md="12">
            <div class="vue-section-head">
              <h2>🌐 公开精选</h2>
              <a :href="urls.learnExplore" class="muted">浏览广场 →</a>
            </div>
            <el-empty v-if="!publicHot.length" description="暂无公开学习资料，去广场看看"></el-empty>
            <el-row :gutter="12" v-else>
              <el-col :xs="24" :sm="12" v-for="m in publicHot" :key="m.id" style="margin-bottom:12px">
                <el-card shadow="hover" class="vue-item-card" @click="go(urls.learnMaterial(m.id))">
                  <div class="vue-card-title">{{ m.title }}</div>
                  <div class="vue-meta">
                    <el-tag size="small" type="primary">{{ kindTag(m.kind) }}</el-tag>
                    <span>👤 {{ m.author_real || m.author_name }}</span>
                    <span>👀 {{ m.views }} 浏览</span>
                  </div>
                </el-card>
              </el-col>
            </el-row>
          </el-col>
        </el-row>
      </div>
    `
  });
})();
