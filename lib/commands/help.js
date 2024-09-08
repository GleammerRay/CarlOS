import * as common from '../common.js';
Object.assign(global, common);

const commandSignatures = [
  {
    name: 'help',
    description: 'List all available commands',
    dm_permission: false,
    type: 1,
  },
];

const buttonSignatures = [
/*
  {
    id: 'template',
  },
*/
];

class Command {
  rest;
  db;
  burstStackManager;

  constructor(options) {
    this.rest = options.rest;
    this.db = options.db;
    this.burstStackManager = options.burstStackManager;
  }

  async execute(interaction) {
    const settings = this.db.get(`guilds/${interaction.guild_id}/settings.json`, defaultSettings);
    const isUserAdmin = isAdmin(interaction.member);
    const isUserMod = interaction.member.roles.indexOf(settings.modRole) != -1;
    const helpMsg = '`/help` - List all available commands' +
        '\n`/report` - Report user';
    var fields = []
    if (isUserMod) {
      const modHelpMsg = '`/warn` - Warn user'
          + '\n`/stats` - Get report summaries';
      fields.push({ name: 'Moderator commands :crossed_swords:', value: modHelpMsg });
    }
    if (isUserAdmin) {
      const adminHelpMsg = '`/subscribe` - Subscribe channel to user reports' +
          '\n`/set` - Set CarlOS roles and other variables' +
          '\n`/get` - Get CarlOS variables';
      fields.push({ name: 'Admin commands :crown:', value: adminHelpMsg });
    }
    return await this.rest.createEphemeralInteractionResponse(interaction, { embeds: [ buildEmbed({ title: 'Command list', description: helpMsg, fields: fields }) ] });
  }

  async executeButton(interaction) {
    const customId = interaction.data.custom_id.split(' ');
    //
  }
}

export { commandSignatures, buttonSignatures, Command };
