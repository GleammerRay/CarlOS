import * as common from '../common.js';
Object.assign(global, common);

const commandSignatures = [
  {
    name: 'set',
    description: 'Set CarlOS roles and other variables',
    dm_permission: false,
    type: 1,
    default_member_permissions: '0',
    default_permission: false,
    options: [
      {
        name: 'mod_role',
        dm_permission: false,
        description: 'Set moderator role',
        type: 1,
        default_member_permissions: '0',
        default_permission: false,
        options: [
          {
            name: 'role',
            description: 'Moderator role',
            type: 8,
            required: true,
          },
        ],
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
    if (!isAdmin(interaction.member)) {
      return await this.rest.createEphemeralInteractionResponse(interaction, { content: 'Permission denied. :lock:' } );
    }
    const options = interaction.data.options;
    if (options == null) return;
    if (options.length < 1) return;
    const option0 = options[0];
    const key = snakeToCamel(option0.name);
    if (key != 'modRole') return;
    if (option0.options == null) return;
    if (option0.options.length < 1) return;
    const option0p0 = option0.options[0];
    const val = option0p0.value;
    var settings = this.db.get(`guilds/${interaction.guild_id}/settings.json`, defaultSettings);
    settings[key] = val;
    this.db.set(`guilds/${interaction.guild_id}/settings.json`, settings);
    if (option0p0.type == 8) {
      return this.rest.createEphemeralInteractionResponse(interaction, { content: `> \`${option0.name}\` = <@&${val}> :screwdriver:` });
    }
    return this.rest.createEphemeralInteractionResponse(interaction, { content: `> \`${option0.name}\` = ${val} :screwdriver:` });
  }

  async executeButton(interaction) {
    const customId = interaction.data.custom_id.split(' ');
    //
  }
}

export { commandSignatures, buttonSignatures, Command };
