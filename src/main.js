import { Game } from './game.js';

const canvas = document.getElementById('game');
const hud = {
    dust: document.getElementById('hud-dust'),
    power: document.getElementById('hud-power'),
    level: document.getElementById('hud-level'),
    combo: document.getElementById('hud-combo'),
    sats: document.getElementById('hud-sats')
};

const buttons = {
    buildSat: document.getElementById('btn-build-sat'),
    buildDrone: document.getElementById('btn-build-drone'),
    upgradeClick: document.getElementById('btn-upgrade-click')
};

const notifications = document.getElementById('notifications');

const game = new Game({ canvas, hud, buttons, notifications });
game.start();
