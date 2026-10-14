'use strict';
/* Mega v programu: jádro je sdílené s prohlížečem (js/mega-core.js). */
const mega = process.env.PROMPTER_MEGA_MOCK ? require(process.env.PROMPTER_MEGA_MOCK) : require('megajs');
module.exports = require('../js/mega-core.js')(mega.Storage);
