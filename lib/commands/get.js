import * as common from '../common.js';
Object.assign(global, common);

const commandSignatures = [
  {
    name: 'get',
    description: 'Get CarlOS variables',
    dm_permission: false,
    type: 1,
    default_member_permissions: '0',
    default_permission: false,
    options: [
      {
        name: 'mod_role',
        dm_permission: false,
        description: 'Get moderator role',
        type: 1,
        default_member_permissions: '0',
        default_permission: false,
      },
    ],
  },
];

const buttonSignatures = [
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
    const options = interaction.data.options;
    if (options == null) return;
    if (options.length < 1) return;
    const option0 = options[0];
    if (option0.name != 'mod_role') return;
    const settings = this.db.get(`guilds/${interaction.guild_id}/settings.json`, defaultSettings);
    const val = settings.modRole;
    return this.rest.createEphemeralInteractionResponse(interaction, { content: `> \`mod_role\` = <@&${val}> :floppy_disk:` });
  }

  async executeButton(interaction) {
    const customId = interaction.data.custom_id.split(' ');
    //
  }
}

export { commandSignatures, buttonSignatures, Command };
