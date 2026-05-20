/**
 * ProAct Video Mode v4 — Light landscape hero demo
 * Entry: ?mode=video&case=finance_basic_01&autoplay=1
 * Controls: Space=play/pause, R=reset
 */

const VideoRenderer = (() => {
  let trace = null;
  let vm = null;
  let startTime = 0;
  let elapsed = 0;
  let running = false;
  let currentPhaseIdx = -1;

  const msg = { idx: 0, charIdx: 0, waiting: false, waitUntil: 0 };
  const ret = { idx: 0, charIdx: 0, waiting: false, waitUntil: 0 };

  let factsRevealed = 0;
  let artifactRevealed = 0;
  let deliveryRendered = false;
  let deliveryStatusRendered = false;
  let ctaRendered = false;

  const dom = {};

  // ── Init ───────────────────────────────────────────────────

  function init(traceData) {
    trace = traceData;
    vm = trace.videoMode;
    cacheDom();
    computeTimings();
    buildTimeline();
    renderHeader();
    reset();
    updatePhase();
    renderPhase();
  }

  function cacheDom() {
    const r = document.querySelector('[data-video-root]');
    dom.root = r;
    dom.titleCard = r.querySelector('[data-v-title-card]');
    dom.titleHeading = r.querySelector('[data-v-title-heading]');
    dom.titleSub = r.querySelector('[data-v-title-sub]');
    dom.topbar = r.querySelector('[data-v-topbar]');
    dom.caseLabel = r.querySelector('[data-v-case]');
    dom.timer = r.querySelector('[data-v-timer]');
    dom.stage = r.querySelector('[data-v-stage]');
    dom.chat = r.querySelector('[data-v-chat]');
    dom.chatInner = r.querySelector('[data-v-chat-inner]');
    dom.typing = r.querySelector('[data-v-typing]');
    dom.idleDivider = r.querySelector('[data-v-idle-divider]');
    dom.idleLabel = r.querySelector('[data-v-idle-label]');
    dom.artifact = r.querySelector('[data-v-artifact]');
    dom.artifactTitle = r.querySelector('[data-v-artifact-title]');
    dom.artifactSub = r.querySelector('[data-v-artifact-subtitle]');
    dom.artifactBody = r.querySelector('[data-v-artifact-body]');
    dom.artifactFooter = r.querySelector('[data-v-artifact-footer]');
    dom.artifactKicker = r.querySelector('[data-v-artifact-kicker]');
    dom.cta = r.querySelector('[data-v-cta]');
    dom.inspector = r.querySelector('[data-v-inspector]');
    dom.inspectorLabel = r.querySelector('[data-v-inspector-label]');
    dom.inspectorBody = r.querySelector('[data-v-inspector-body]');
    dom.timeline = r.querySelector('[data-v-timeline]');
    dom.recap = r.querySelector('[data-v-recap]');
    dom.recapLines = r.querySelector('[data-v-recap-lines]');

    if (!dom.artifactSub && dom.artifactTitle) {
      dom.artifactSub = document.createElement('p');
      dom.artifactSub.className = 'v-artifact__subtitle';
      dom.artifactSub.dataset.vArtifactSubtitle = '';
      dom.artifactTitle.insertAdjacentElement('afterend', dom.artifactSub);
    }

    dom.handoff = r.querySelector('[data-v-push-handoff]');
    if (!dom.handoff && dom.chat) {
      dom.handoff = document.createElement('div');
      dom.handoff.className = 'v-push-handoff';
      dom.handoff.dataset.vPushHandoff = '';
      dom.chat.appendChild(dom.handoff);
    }
  }

  function computeTimings() {
    vm.phases.forEach(phase => {
      if (!phase.messages) return;
      let cursor = 0;
      phase.messages.forEach(m => {
        m._startMs = cursor;
        const typing = m.role === 'assistant' ? (m.typingDelayMs || 800) : 0;
        cursor += typing + (m.displayDurationMs || 3000) + 600;
      });
    });
  }

  function renderHeader() {
    if (dom.caseLabel) {
      dom.caseLabel.textContent = trace.domain + ' · ' + trace.title;
    }
  }

  function buildTimeline() {
    if (!dom.timeline) return;
    dom.timeline.innerHTML = '';
    dom.timelineSegs = [];
    const total = vm.totalDurationMs;
    vm.phases.forEach(phase => {
      const seg = document.createElement('div');
      seg.className = 'v-timeline__seg';
      const weight = (phase.endMs - phase.startMs) / total;
      seg.style.flex = String(weight);
      const label = document.createElement('span');
      label.className = 'v-timeline__label';
      label.textContent = phase.label;
      seg.appendChild(label);
      dom.timeline.appendChild(seg);
      dom.timelineSegs.push(seg);
    });
  }

  function reset() {
    elapsed = 0;
    currentPhaseIdx = -1;
    Object.assign(msg, { idx: 0, charIdx: 0, waiting: false, waitUntil: 0 });
    Object.assign(ret, { idx: 0, charIdx: 0, waiting: false, waitUntil: 0 });
    factsRevealed = 0;
    artifactRevealed = 0;
    deliveryRendered = false;
    deliveryStatusRendered = false;
    ctaRendered = false;

    dom.chatInner.querySelectorAll('.v-bubble').forEach(el => el.remove());
    dom.typing.classList.remove('is-visible');
    dom.idleDivider.classList.remove('is-visible');
    dom.titleCard.classList.remove('is-visible', 'is-fading');
    dom.topbar.classList.remove('is-visible');
    dom.artifact.classList.remove('is-visible', 'v-artifact--wide', 'v-artifact--policy', 'v-artifact--delivered');
    if (dom.artifactSub) dom.artifactSub.textContent = '';
    dom.artifactBody.innerHTML = '';
    dom.inspector.classList.remove('is-open');
    dom.inspectorBody.innerHTML = '';
    dom.recap.classList.remove('is-visible');
    if (dom.recapLines) dom.recapLines.innerHTML = '';
    dom.chat.classList.remove('is-dimmed', 'is-delivered');
    dom.cta.classList.remove('is-visible');
    dom.cta.innerHTML = '';
    hidePushHandoff();

    if (dom.timelineSegs) {
      dom.timelineSegs.forEach(s => s.classList.remove('is-active', 'is-past'));
    }

    updateTimer(0);
  }

  // ── Playback ───────────────────────────────────────────────

  function play() {
    if (running) return;
    running = true;
    startTime = performance.now() - elapsed;
    requestAnimationFrame(tick);
  }

  function pause() { running = false; }

  function seek(ms) {
    running = false;
    reset();
    elapsed = Math.max(0, Math.min(vm.totalDurationMs, ms));
    if (elapsed > 0) dom.topbar.classList.add('is-visible');
    renderSeekContext(elapsed);
    updateTimer(elapsed);
    updatePhase();
    renderPhase();
  }

  function tick(now) {
    if (!running) return;
    elapsed = now - startTime;
    const total = vm.totalDurationMs;
    if (elapsed >= total) { elapsed = total; running = false; }
    updateTimer(elapsed);
    updatePhase();
    renderPhase();
    if (running) requestAnimationFrame(tick);
  }

  function updateTimer(ms) {
    const s = Math.floor(ms / 1000);
    const t = Math.floor(vm.totalDurationMs / 1000);
    const pad = n => String(n).padStart(2, '0');
    if (dom.timer) {
      dom.timer.textContent = `${Math.floor(s / 60)}:${pad(s % 60)} / ${Math.floor(t / 60)}:${pad(t % 60)}`;
    }
  }

  // ── Phase Management ───────────────────────────────────────

  function updatePhase() {
    const phases = vm.phases;
    let idx = -1;
    for (let i = 0; i < phases.length; i++) {
      if (elapsed >= phases[i].startMs) idx = i;
    }
    if (idx !== currentPhaseIdx) {
      if (currentPhaseIdx >= 0) onPhaseExit(currentPhaseIdx);
      currentPhaseIdx = idx;
      if (idx >= 0) onPhaseEnter(idx);
      updateTimelineHighlight(idx);
    }
  }

  function updateTimelineHighlight(idx) {
    if (!dom.timelineSegs) return;
    dom.timelineSegs.forEach((seg, i) => {
      seg.classList.toggle('is-active', i === idx);
      seg.classList.toggle('is-past', i < idx);
    });
  }

  function onPhaseEnter(idx) {
    const phase = vm.phases[idx];
    switch (phase.id) {
      case 'title_card':
        dom.titleCard.classList.add('is-visible');
        if (dom.titleHeading) dom.titleHeading.textContent = phase.heading;
        if (dom.titleSub) dom.titleSub.textContent = phase.subtitle;
        break;
      case 'conversation':
        dom.topbar.classList.add('is-visible');
        dom.chat.classList.remove('is-dimmed');
        break;
      case 'idle_transition':
        dom.chat.classList.add('is-dimmed');
        dom.idleDivider.classList.add('is-visible');
        break;
      case 'predict':
        dom.chat.classList.add('is-dimmed');
        openInspector(phase.inspectorLabel);
        break;
      case 'explore':
        dom.chat.classList.add('is-dimmed');
        openInspector(phase.inspectorLabel);
        factsRevealed = 0;
        break;
      case 'artifact':
        closeInspector();
        dom.chat.classList.add('is-dimmed');
        showArtifact(phase);
        break;
      case 'artifact_table':
        closeInspector();
        dom.chat.classList.add('is-dimmed');
        showArtifact(phase);
        break;
      case 'delivery':
        closeInspector();
        dom.chat.classList.add('is-dimmed');
        hidePushHandoff();
        showDelivery(phase);
        break;
      case 'push_handoff':
        closeInspector();
        dom.chat.classList.add('is-dimmed');
        dom.artifact.classList.remove('is-visible');
        showPushHandoff(phase);
        break;
      case 'push_delivered':
        closeInspector();
        dom.chat.classList.remove('is-dimmed');
        dom.chat.classList.add('is-delivered');
        dom.artifact.classList.remove('is-visible');
        showPushHandoff(phase, { docked: true });
        showDeliveredBubble(phase);
        break;
      case 'user_return':
        dom.artifact.classList.remove('is-visible');
        hidePushHandoff();
        dom.chat.classList.remove('is-dimmed');
        Object.assign(ret, { idx: 0, charIdx: 0, waiting: false, waitUntil: 0 });
        ctaRendered = false;
        break;
      case 'recap':
        showRecap(phase);
        break;
    }
  }

  function onPhaseExit(idx) {
    const phase = vm.phases[idx];
    switch (phase.id) {
      case 'title_card':
        dom.titleCard.classList.add('is-fading');
        break;
      case 'idle_transition':
        break;
    }
  }

  // ── Inspector ──────────────────────────────────────────────

  function openInspector(label) {
    dom.inspector.classList.add('is-open');
    if (dom.inspectorLabel) dom.inspectorLabel.textContent = label;
    dom.inspectorBody.innerHTML = '';
  }

  function closeInspector() {
    dom.inspector.classList.remove('is-open');
  }

  // ── Artifact ───────────────────────────────────────────────

  function showArtifact(phase) {
    if (dom.artifactKicker) dom.artifactKicker.textContent = 'Prepared Artifact';
    if (dom.artifactTitle) dom.artifactTitle.textContent = phase.artifactTitle;
    if (dom.artifactSub) dom.artifactSub.textContent = phase.artifactSubtitle || '';
    dom.artifactBody.innerHTML = '';
    if (dom.artifactFooter) dom.artifactFooter.textContent = phase.artifactFooter || '';
    artifactRevealed = 0;
    applyArtifactClass(phase.artifactClass);
    dom.artifact.classList.add('is-visible');
  }

  function showDelivery(phase) {
    if (dom.artifactKicker) dom.artifactKicker.textContent = '';
    if (dom.artifactTitle) dom.artifactTitle.textContent = phase.deliveryTitle;
    if (dom.artifactSub) dom.artifactSub.textContent = '';
    dom.artifactBody.innerHTML = '';
    if (dom.artifactFooter) dom.artifactFooter.textContent = '';
    deliveryRendered = false;
    deliveryStatusRendered = false;
    artifactRevealed = 0;
    applyArtifactClass(phase.artifactClass || 'policy');
    dom.artifact.classList.add('is-visible');
  }

  function showPushDelivered(phase) {
    if (dom.artifactKicker) dom.artifactKicker.textContent = 'PUSH DELIVERED';
    if (dom.artifactTitle) dom.artifactTitle.textContent = phase.artifactTitle;
    if (dom.artifactSub) dom.artifactSub.textContent = phase.artifactSubtitle || '';
    dom.artifactBody.innerHTML = '';
    if (dom.artifactFooter) dom.artifactFooter.textContent = phase.artifactFooter || '';
    applyArtifactClass(phase.artifactClass || 'wide delivered');
    dom.artifact.classList.add('is-visible');
    renderStructuredArtifact(phase, Infinity, { revealAll: true });
    renderArtifactActions(phase.cta);
  }

  function showDeliveredBubble(phase) {
    const existing = dom.chatInner.querySelector('[data-idx="delivered-bubble"]');
    if (existing) return;

    const bubble = document.createElement('div');
    bubble.className = 'v-bubble v-bubble--delivered';
    bubble.dataset.idx = 'delivered-bubble';

    const role = document.createElement('span');
    role.className = 'v-bubble__role';
    role.textContent = 'ProAct';
    bubble.appendChild(role);

    const header = document.createElement('div');
    header.className = 'v-delivered-header';
    const badge = document.createElement('span');
    badge.className = 'v-delivered-header__badge';
    badge.textContent = 'PROACTIVE PUSH';
    header.appendChild(badge);
    const headerText = document.createElement('span');
    headerText.className = 'v-delivered-header__text';
    headerText.textContent = phase.artifactSubtitle || 'Prepared during idle time';
    header.appendChild(headerText);
    bubble.appendChild(header);

    const body = document.createElement('div');
    body.className = 'v-delivered-body';

    const title = document.createElement('h3');
    title.className = 'v-artifact__title';
    title.textContent = phase.artifactTitle;
    body.appendChild(title);

    if (phase.summaryRows) {
      const summary = document.createElement('div');
      summary.className = 'v-brief-summary';
      phase.summaryRows.forEach(row => {
        summary.appendChild(createSummaryRow(row));
      });
      body.appendChild(summary);
    }

    if (phase.tableRows) {
      const table = document.createElement('div');
      table.className = 'v-artifact-table';

      const tableHeader = document.createElement('div');
      tableHeader.className = 'v-artifact-table__row v-artifact-table__row--head';
      ['Area', 'Finding', 'Next step'].forEach(text => {
        const cell = document.createElement('span');
        cell.textContent = text;
        tableHeader.appendChild(cell);
      });
      table.appendChild(tableHeader);

      const tableBody = document.createElement('div');
      tableBody.className = 'v-artifact-table__body';
      phase.tableRows.forEach(row => {
        tableBody.appendChild(createTableRow(row));
      });
      table.appendChild(tableBody);
      body.appendChild(table);
    }

    bubble.appendChild(body);

    if (phase.cta?.length) {
      const actions = document.createElement('div');
      actions.className = 'v-delivered-actions';
      phase.cta.forEach(action => {
        const btn = document.createElement('button');
        btn.className = `v-cta__btn v-cta__btn--${action.style || 'secondary'}`;
        btn.type = 'button';
        btn.textContent = action.label;
        actions.appendChild(btn);
      });
      bubble.appendChild(actions);
    }

    dom.chatInner.insertBefore(bubble, dom.typing);
  }

  function applyArtifactClass(value = '') {
    dom.artifact.classList.remove('v-artifact--wide', 'v-artifact--policy', 'v-artifact--delivered');
    const tokens = String(value).split(/\s+/).filter(Boolean);
    if (tokens.includes('wide')) dom.artifact.classList.add('v-artifact--wide');
    if (tokens.includes('policy')) dom.artifact.classList.add('v-artifact--policy');
    if (tokens.includes('delivered')) dom.artifact.classList.add('v-artifact--delivered');
  }

  function showPushHandoff(phase, options = {}) {
    if (!dom.handoff) return;
    const notification = phase.notification;
    if (!notification) {
      hidePushHandoff();
      return;
    }

    dom.handoff.innerHTML = '';
    dom.handoff.className = 'v-push-handoff';
    if (options.docked) dom.handoff.classList.add('is-docked');

    const card = document.createElement('div');
    card.className = 'v-push-notification';

    const badge = document.createElement('span');
    badge.className = 'v-push-notification__badge';
    badge.textContent = options.docked ? 'PUSH RECEIVED' : 'PUSH TO USER';
    card.appendChild(badge);

    const title = document.createElement('div');
    title.className = 'v-push-notification__title';
    title.textContent = notification.title;
    card.appendChild(title);

    const body = document.createElement('div');
    body.className = 'v-push-notification__body';
    body.textContent = notification.body;
    card.appendChild(body);

    const meta = document.createElement('div');
    meta.className = 'v-push-notification__meta';
    [notification.meta, notification.safety].filter(Boolean).forEach(text => {
      const item = document.createElement('span');
      item.textContent = text;
      meta.appendChild(item);
    });
    card.appendChild(meta);

    if (notification.actions?.length) {
      const actions = document.createElement('div');
      actions.className = 'v-push-notification__actions';
      notification.actions.forEach(action => {
        const btn = document.createElement('button');
        btn.className = `v-cta__btn v-cta__btn--${action.style || 'secondary'}`;
        btn.type = 'button';
        btn.textContent = action.label;
        actions.appendChild(btn);
      });
      card.appendChild(actions);
    }

    dom.handoff.appendChild(card);
    dom.handoff.classList.add('is-visible');
  }

  function hidePushHandoff() {
    if (!dom.handoff) return;
    dom.handoff.classList.remove('is-visible', 'is-docked');
    dom.handoff.innerHTML = '';
  }

  // ── Recap ──────────────────────────────────────────────────

  function showRecap(phase) {
    if (dom.recapLines && phase.summaryLines) {
      dom.recapLines.innerHTML = '';
      phase.summaryLines.forEach(line => {
        const p = document.createElement('p');
        p.className = 'v-recap__line';
        p.textContent = line;
        dom.recapLines.appendChild(p);
      });
    }
    dom.recap.classList.add('is-visible');
  }

  // ── Phase Renderers ────────────────────────────────────────

  function renderPhase() {
    if (currentPhaseIdx < 0) return;
    const phase = vm.phases[currentPhaseIdx];
    const pe = elapsed - phase.startMs;

    switch (phase.id) {
      case 'conversation': renderMessages(pe, phase, msg, dom.chatInner); break;
      case 'idle_transition': renderIdle(pe, phase); break;
      case 'predict': renderPredict(pe, phase); break;
      case 'explore': renderExplore(pe, phase); break;
      case 'artifact': renderArtifactItems(pe, phase); break;
      case 'artifact_table': renderArtifactItems(pe, phase); break;
      case 'delivery': renderDeliveryItems(pe, phase); break;
      case 'push_handoff': break;
      case 'user_return': renderReturn(pe, phase); break;
    }
  }

  // ── Shared Typewriter ──────────────────────────────────────

  function renderMessages(pe, phase, state, container) {
    const msgs = phase.messages;
    if (!msgs || state.idx >= msgs.length) return;

    const m = msgs[state.idx];
    if (pe < m._startMs) return;
    const me = pe - m._startMs;

    if (state.waiting) {
      if (pe >= state.waitUntil) {
        state.waiting = false;
        state.idx++;
        state.charIdx = 0;
        dom.typing.classList.remove('is-visible');
      }
      return;
    }

    if (m.role === 'assistant' && state.charIdx === 0 && me < m.typingDelayMs) {
      dom.typing.classList.add('is-visible');
      return;
    }
    dom.typing.classList.remove('is-visible');

    const bubbleId = phase.id === 'user_return' ? `ret-${state.idx}` : `msg-${state.idx}`;
    let bubble = container.querySelector(`[data-idx="${bubbleId}"]`);
    if (!bubble) {
      bubble = document.createElement('div');
      bubble.className = `v-bubble v-bubble--${m.role}`;
      if (m.isIdleTrigger) bubble.classList.add('v-bubble--idle-trigger');
      bubble.dataset.idx = bubbleId;

      const role = document.createElement('span');
      role.className = 'v-bubble__role';
      role.textContent = m.role === 'user' ? 'You' : 'ProAct';
      bubble.appendChild(role);

      const text = document.createElement('span');
      text.className = 'v-bubble__text';
      bubble.appendChild(text);

      container.insertBefore(bubble, dom.typing);
    }

    const textEl = bubble.querySelector('.v-bubble__text');
    const typingOffset = m.role === 'assistant' ? m.typingDelayMs : 0;
    const te = me - typingOffset;
    if (te < 0) return;

    const speed = m.text.length / (m.displayDurationMs * 0.55);
    const target = Math.min(m.text.length, Math.floor(te * speed));

    if (target > state.charIdx) {
      state.charIdx = target;
      if (state.charIdx >= m.text.length) {
        textEl.textContent = m.text;
        state.waiting = true;
        state.waitUntil = pe + 600;
      } else {
        textEl.textContent = m.text.substring(0, state.charIdx);
      }
    }
  }

  function renderSeekContext(ms) {
    const conversation = vm.phases.find(phase => phase.id === 'conversation');
    if (conversation && ms >= conversation.endMs) {
      renderStaticMessages(conversation.messages || []);
    }

    const idlePhase = vm.phases.find(phase => phase.id === 'idle_transition');
    if (idlePhase && ms >= idlePhase.startMs) {
      dom.idleDivider.classList.add('is-visible');
      renderIdle(Math.min(ms, idlePhase.endMs) - idlePhase.startMs, idlePhase);
    }
  }

  function renderStaticMessages(messages) {
    messages.forEach((m, i) => {
      const bubbleId = `msg-${i}`;
      if (dom.chatInner.querySelector(`[data-idx="${bubbleId}"]`)) return;

      const bubble = document.createElement('div');
      bubble.className = `v-bubble v-bubble--${m.role}`;
      if (m.isIdleTrigger) bubble.classList.add('v-bubble--idle-trigger');
      bubble.dataset.idx = bubbleId;
      bubble.style.animation = 'none';
      bubble.style.opacity = '1';
      bubble.style.transform = 'none';

      const role = document.createElement('span');
      role.className = 'v-bubble__role';
      role.textContent = m.role === 'user' ? 'You' : 'ProAct';
      bubble.appendChild(role);

      const text = document.createElement('span');
      text.className = 'v-bubble__text';
      text.textContent = m.text;
      bubble.appendChild(text);

      dom.chatInner.insertBefore(bubble, dom.typing);
    });
  }

  // ── Idle ───────────────────────────────────────────────────

  function renderIdle(pe, phase) {
    if (!dom.idleLabel) return;
    const acc = phase.clockAcceleration || 4;
    const maxSec = parseInt(phase.idleDuration) || 18;
    const sec = Math.min(maxSec, Math.floor(pe / 1000 * acc));
    dom.idleLabel.textContent = `${phase.idleLabel} · ${sec}s`;
  }

  // ── Predict ────────────────────────────────────────────────

  function renderPredict(pe, phase) {
    if (dom.inspectorBody.children.length > 0) return;

    const p = phase.prediction;
    const body = dom.inspectorBody;

    const title = document.createElement('div');
    title.className = 'v-predict-title';
    title.textContent = p.title;
    body.appendChild(title);

    const summary = document.createElement('div');
    summary.className = 'v-predict-summary';
    summary.textContent = p.summary;
    body.appendChild(summary);

    if (phase.badges) {
      const badges = document.createElement('div');
      badges.className = 'v-predict-badges';
      phase.badges.forEach((b, i) => {
        const badge = document.createElement('span');
        badge.className = 'v-predict-badge';
        badge.style.animationDelay = `${i * 150}ms`;
        badge.textContent = b;
        badges.appendChild(badge);
      });
      body.appendChild(badges);
    }

    if (phase.candidates) {
      const list = document.createElement('div');
      list.className = 'v-predict-candidates';
      phase.candidates.forEach((c, i) => {
        const row = document.createElement('div');
        row.className = 'v-predict-candidate';
        if (c.selected) row.classList.add('is-selected');
        row.style.animationDelay = `${i * 200}ms`;

        const text = document.createElement('span');
        text.textContent = (c.selected ? '→ ' : '') + c.title;
        row.appendChild(text);

        const conf = document.createElement('span');
        conf.className = 'v-predict-candidate__conf';
        conf.textContent = c.confidence;
        row.appendChild(conf);

        list.appendChild(row);
      });
      body.appendChild(list);
    }
  }

  // ── Explore ────────────────────────────────────────────────

  function renderExplore(pe, phase) {
    if (!phase.facts) return;
    const dur = phase.endMs - phase.startMs;
    const interval = dur / phase.facts.length;
    const target = Math.min(phase.facts.length, Math.floor(pe / interval) + 1);
    ensureEvidenceSafetyNote(phase);

    while (factsRevealed < target) {
      const f = phase.facts[factsRevealed];
      const chip = document.createElement('span');
      chip.className = 'v-evidence-chip';
      chip.style.animationDelay = `${factsRevealed * 80}ms`;

      const id = document.createElement('span');
      id.className = 'v-evidence-chip__id';
      id.textContent = f.factId;
      chip.appendChild(id);

      const label = document.createElement('span');
      label.className = 'v-evidence-chip__label';
      label.textContent = f.label;
      chip.appendChild(label);

      dom.inspectorBody.insertBefore(chip, dom.inspectorBody.querySelector('.v-safety-note'));
      factsRevealed++;
    }
  }

  function ensureEvidenceSafetyNote(phase) {
    if (phase.safetyNote && !dom.inspectorBody.querySelector('.v-safety-note')) {
      const note = document.createElement('div');
      note.className = 'v-safety-note';
      note.textContent = phase.safetyNote;
      dom.inspectorBody.appendChild(note);
    }
  }

  // ── Artifact Items ─────────────────────────────────────────

  function renderArtifactItems(pe, phase) {
    if (phase.summaryRows || phase.tableRows) {
      renderStructuredArtifact(phase, pe);
      return;
    }

    if (!phase.items) return;
    const dur = phase.endMs - phase.startMs;
    const interval = dur / phase.items.length;
    const target = Math.min(phase.items.length, Math.floor(pe / interval) + 1);

    while (artifactRevealed < target) {
      const item = phase.items[artifactRevealed];
      const line = document.createElement('div');
      line.className = 'v-artifact-item';
      line.style.animationDelay = `${artifactRevealed * 100}ms`;

      const text = document.createTextNode(item.text);
      line.appendChild(text);

      if (item.ref) {
        const ref = document.createElement('span');
        ref.className = 'v-artifact-item__ref';
        ref.textContent = item.ref;
        line.appendChild(ref);
      }

      dom.artifactBody.appendChild(line);
      artifactRevealed++;
    }
  }

  function renderStructuredArtifact(phase, pe, options = {}) {
    const revealAll = options.revealAll || pe === Infinity;
    if (phase.summaryRows && !dom.artifactBody.querySelector('.v-brief-summary')) {
      const summary = document.createElement('div');
      summary.className = 'v-brief-summary';
      dom.artifactBody.appendChild(summary);
    }

    const summary = dom.artifactBody.querySelector('.v-brief-summary');
    const hasTable = Array.isArray(phase.tableRows) && phase.tableRows.length > 0;
    const summaryRows = phase.summaryRows || [];

    if (summaryRows.length) {
      const progressiveTarget = Math.floor(pe / ((phase.endMs - phase.startMs) / summaryRows.length)) + 1;
      const minimumVisibleRows = phase.minimumSummaryRows ?? 3;
      const summaryTarget = hasTable || revealAll
        ? summaryRows.length
        : Math.min(summaryRows.length, Math.max(minimumVisibleRows, progressiveTarget));
      while (summary && summary.children.length < summaryTarget) {
        summary.appendChild(createSummaryRow(summaryRows[summary.children.length]));
      }
    }

    if (!hasTable) return;

    let table = dom.artifactBody.querySelector('.v-artifact-table');
    if (!table) {
      table = document.createElement('div');
      table.className = 'v-artifact-table';

      const header = document.createElement('div');
      header.className = 'v-artifact-table__row v-artifact-table__row--head';
      ['Area', 'Prepared finding', 'Next step'].forEach(text => {
        const cell = document.createElement('span');
        cell.textContent = text;
        header.appendChild(cell);
      });
      table.appendChild(header);

      const body = document.createElement('div');
      body.className = 'v-artifact-table__body';
      table.appendChild(body);
      dom.artifactBody.appendChild(table);
      artifactRevealed = 0;
    }

    const tableBody = table.querySelector('.v-artifact-table__body');
    const tableRows = phase.tableRows;
    const tableDelay = phase.tableRevealDelayMs || 0;
    const tableElapsed = Math.max(0, pe - tableDelay);
    const interval = revealAll ? 0 : Math.max(450, (phase.endMs - phase.startMs - tableDelay) / tableRows.length);
    const target = revealAll ? tableRows.length : Math.min(tableRows.length, Math.floor(tableElapsed / interval) + 1);

    while (artifactRevealed < target) {
      tableBody.appendChild(createTableRow(tableRows[artifactRevealed]));
      artifactRevealed++;
    }
  }

  function createSummaryRow(row) {
    const item = document.createElement('div');
    item.className = 'v-brief-summary__row';

    const label = document.createElement('span');
    label.className = 'v-brief-summary__label';
    label.textContent = row.label;
    item.appendChild(label);

    const value = document.createElement('span');
    value.className = 'v-brief-summary__value';
    value.textContent = row.value;
    item.appendChild(value);

    if (row.ref) item.appendChild(createRefChip(row.ref));
    return item;
  }

  function createTableRow(row) {
    const item = document.createElement('div');
    item.className = 'v-artifact-table__row';

    [row.area, row.finding, row.nextStep].forEach((text, index) => {
      const cell = document.createElement('span');
      cell.className = index === 0 ? 'v-artifact-table__area' : '';
      cell.textContent = text;
      item.appendChild(cell);
    });

    return item;
  }

  function createRefChip(text) {
    const ref = document.createElement('span');
    ref.className = 'v-artifact-item__ref';
    ref.textContent = text;
    return ref;
  }

  function renderArtifactActions(actions) {
    if (!actions?.length) return;
    const row = document.createElement('div');
    row.className = 'v-artifact-actions';
    actions.forEach(action => {
      const btn = document.createElement('button');
      btn.className = `v-cta__btn v-cta__btn--${action.style || 'secondary'}`;
      btn.type = 'button';
      btn.textContent = action.label;
      row.appendChild(btn);
    });
    dom.artifactBody.appendChild(row);
  }

  // ── Delivery Items ─────────────────────────────────────────

  function renderDeliveryItems(pe, phase) {
    const dur = phase.endMs - phase.startMs;
    const revealAt = dur * 0.1;
    if (!deliveryRendered) {
      if (pe < revealAt) return;

      deliveryRendered = true;
      dom.artifactBody.innerHTML = '';

      const options = document.createElement('div');
      options.className = 'v-delivery-options';
      dom.artifactBody.appendChild(options);

      phase.options.forEach((opt) => {
        const row = document.createElement('div');
        row.className = ['v-delivery-row', opt.class ? `v-delivery-row--${opt.class}` : ''].filter(Boolean).join(' ');

        const status = document.createElement('span');
        status.className = `v-delivery-row__status v-delivery-row__status--${opt.class}`;
        status.textContent = opt.status;
        row.appendChild(status);

        const mode = document.createElement('span');
        mode.className = 'v-delivery-row__mode';
        mode.textContent = opt.mode;
        row.appendChild(mode);

        const label = document.createElement('span');
        label.className = `v-delivery-row__label v-delivery-row__label--${opt.class}`;
        label.textContent = opt.statusLabel;
        row.appendChild(label);

        const reason = document.createElement('span');
        reason.className = 'v-delivery-row__reason';
        reason.textContent = opt.reason;
        row.appendChild(reason);

        options.appendChild(row);
      });

      if (phase.summaryLines) {
        const summary = document.createElement('div');
        summary.className = 'v-delivery-summary';
        phase.summaryLines.forEach(line => {
          const p = document.createElement('div');
          p.className = 'v-delivery-summary__line';
          p.textContent = line;
          summary.appendChild(p);
        });
        dom.artifactBody.appendChild(summary);
      }
    }

    const statusAt = phase.statusRevealMs ?? Math.min(dur - 900, Math.max(3200, dur * 0.72));
    if (phase.statusLine && pe >= statusAt && !deliveryStatusRendered) {
      deliveryStatusRendered = true;
      const status = document.createElement('div');
      status.className = 'v-delivery-push-status';

      const dot = document.createElement('span');
      dot.className = 'v-delivery-push-status__dot';
      status.appendChild(dot);

      const text = document.createElement('span');
      text.textContent = phase.statusLine;
      status.appendChild(text);

      dom.artifactBody.appendChild(status);
    }
  }

  // ── User Return ────────────────────────────────────────────

  function renderReturn(pe, phase) {
    renderMessages(pe, phase, ret, dom.chatInner);

    if (!ctaRendered && phase.cta && ret.idx >= phase.messages.length) {
      ctaRendered = true;
      dom.cta.innerHTML = '';
      phase.cta.forEach(c => {
        const btn = document.createElement('button');
        btn.className = `v-cta__btn v-cta__btn--${c.style}`;
        btn.textContent = c.label;
        btn.type = 'button';
        dom.cta.appendChild(btn);
      });
      dom.cta.classList.add('is-visible');
    }
  }

  // ── Helpers ────────────────────────────────────────────────

  function esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  }

  // ── Public API ─────────────────────────────────────────────

  return {
    init,
    play,
    pause,
    seek,
    reset,
    toggle() { running ? pause() : play(); },
  };
})();

// ── Boot ────────────────────────────────────────────────────

(async function () {
  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') !== 'video') return;

  const caseId = params.get('case') || 'finance_basic_01';
  const autoplay = params.get('autoplay') === '1';
  const pinnedSeconds = params.has('t') ? Number(params.get('t')) : null;

  try {
    const resp = await fetch(`traces/${caseId}.json`);
    if (!resp.ok) throw new Error(`Trace not found: ${caseId}`);
    const trace = await resp.json();

    if (!trace.videoMode || trace.videoMode.version < 4) {
      console.error('Requires videoMode v4+');
      return;
    }

    VideoRenderer.init(trace);
    if (Number.isFinite(pinnedSeconds)) {
      VideoRenderer.seek(pinnedSeconds * 1000);
    }

    document.addEventListener('keydown', e => {
      if (e.code === 'Space') { e.preventDefault(); VideoRenderer.toggle(); }
      if (e.code === 'KeyR') VideoRenderer.reset();
    });

    if (autoplay) setTimeout(() => VideoRenderer.play(), 500);
  } catch (err) {
    console.error('Video mode failed:', err);
  }
})();
