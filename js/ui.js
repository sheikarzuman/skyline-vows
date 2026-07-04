/* ============================================================
   ui.js — menus, HUD, touch control wiring
   All chrome lives in the DOM (see index.html); the UI class
   just shows/hides screens and pushes HUD values.
   ============================================================ */

class UI {
  constructor(game) {
    this.game = game;
    const $ = id => document.getElementById(id);

    this.els = {
      hud: $('hud'), menu: $('menu'), howto: $('howto'), pause: $('pause'),
      choice: $('choice'), credits: $('credits'), funny: $('funny'),
      banner: $('banner'), dialogue: $('dialogue'), fade: $('fade'),
      touch: $('touch'), rotateHint: $('rotateHint'),
      height: $('height'), timer: $('timer'),
      stamina: $('stamina'), progress: $('progress'),
    };

    /* ---------- button wiring ---------- */
    const click = (id, fn) => $(id).addEventListener('click', () => {
      game.audio.unlock(); game.audio.sfx('ui'); fn();
    });

    click('btnStart',   () => game.start());

    // stage select: buttons carry data-stage="1".."6"
    for (const b of document.querySelectorAll('#stageSelect .sbtn'))
      b.addEventListener('click', () => {
        game.audio.unlock(); game.audio.sfx('ui');
        game.start(parseInt(b.dataset.stage, 10) - 1);
      });
    click('btnHow',     () => this.show('howto'));
    click('btnEnding',  () => game.skipToEnding());
    click('btnBack',    () => this.show('menu'));
    click('btnPause',   () => game.pause());
    click('btnResume',  () => game.resume());
    click('btnRestart', () => game.start());
    click('btnQuit',    () => game.quitToMenu());
    click('btnYes',     () => game.acceptProposal());
    click('btnNo',      () => game.rejectProposal());
    click('btnAgain',   () => game.start());
    click('btnAgain2',  () => game.start());

    const syncSound = on => {
      const label = 'Sound: ' + (on ? 'ON' : 'OFF');
      $('btnSound').textContent = label;
      $('btnSound2').textContent = label;
    };
    click('btnSound',  () => syncSound(game.audio.toggle()));
    click('btnSound2', () => syncSound(game.audio.toggle()));

    /* ---------- touch controls ---------- */
    if (game.input.isTouch) {
      this.els.touch.classList.remove('hidden');
      game.input.bindTouch({
        joyZone: $('joyZone'), joyBase: $('joyBase'), joyKnob: $('joyKnob'),
        btnJump: $('btnJump'), btnGrab: $('btnGrab'),
      });
      this._checkOrientation();
      addEventListener('resize', () => this._checkOrientation());
    }
  }

  _checkOrientation() {
    const bad = innerHeight > innerWidth && innerWidth < 700;
    this.els.rotateHint.classList.toggle('hidden', !bad);
  }

  /** Show one screen, hide the rest. Pass null for gameplay. */
  show(name) {
    for (const s of ['menu', 'howto', 'pause', 'choice', 'credits', 'funny'])
      this.els[s].classList.toggle('hidden', s !== name);
    this.els.hud.classList.toggle('hidden', name !== null);
    if (this.game.input.isTouch)
      this.els.touch.classList.toggle('hidden', name !== null);
  }

  /* ---------- HUD ---------- */
  updateHUD(heightM, stamina, progress, time) {
    this.els.height.textContent = `${heightM | 0} m`;
    const mm = String((time / 60) | 0).padStart(2, '0');
    const ss = String((time | 0) % 60).padStart(2, '0');
    this.els.timer.textContent = `${mm}:${ss}`;
    this.els.stamina.style.width = `${stamina}%`;
    this.els.stamina.classList.toggle('low', stamina < 30);
    this.els.progress.style.width = `${clamp(progress * 100, 0, 100)}%`;
  }

  /** Stage title card — re-triggers its CSS animation. */
  banner(text, color) {
    const b = this.els.banner;
    b.textContent = text;
    b.style.textShadow = `0 0 16px ${color}`;
    b.classList.remove('hidden');
    b.style.animation = 'none';
    void b.offsetWidth;                 // reflow to restart the animation
    b.style.animation = '';
  }

  dialogue(text) {
    const d = this.els.dialogue;
    if (!text) { d.classList.add('hidden'); return; }
    d.innerHTML = text;
    d.classList.remove('hidden');
  }

  /** Quick fade for respawns: fades in, runs fn, fades out. */
  fadeFlash(fn) {
    this.els.fade.style.opacity = '1';
    setTimeout(() => { fn(); this.els.fade.style.opacity = '0'; }, 360);
  }
}
