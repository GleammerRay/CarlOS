import * as common from '../common.js';
Object.assign(global, common);

const commandSignatures = [
  {
    name: 'topics',
    description: 'Manage and list report topics',
    dm_permission: false,
    type: 1,
    options: [
      {
        name: 'list',
        description: 'List report topics and threads',
        dm_permission: false,
        type: 1,
      },
    ],
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

  async executeList(interaction) {
    const topicThreads = this.db.get(`guilds/${interaction.guild_id}/topic_threads.json`, defaultThreads);
    if (topicThreads.threads.length == 0) {
      return await this.rest.createEphemeralInteractionResponse(interaction, { content: 'No topic threads are created yet. :empty_nest:' } );
    }
    var descriptionArray = [];
    for (const key of Object.keys(topicThreads.threads)) {
      const val = topicThreads.threads[key];
      descriptionArray.push(`\`${key}\` - <#${val}>`);
    }
    const description = descriptionArray.join('\n');
    return await this.rest.createEphemeralInteractionResponse(interaction, { embeds: [ buildEmbed({ title: 'Report topics', description: description }) ] });
  }

  async execute(interaction) {
    const settings = this.db.get(`guilds/${interaction.guild_id}/settings.json`, defaultSettings);
    if (!isAdmin(interaction.member) && interaction.member.roles.indexOf(settings.modRole) == -1) {
      return await this.rest.createEphemeralInteractionResponse(interaction, { content: 'Permission denied. :lock:' } );
    }
    const options = interaction.data.options;
    if (options == null) return;
    if (options.length < 1) return;
    const option0 = options[0];
    if (option0.name != 'list') return;
    return this.executeList(interaction);
  }

  async executeButton(interaction) {
    const customId = interaction.data.custom_id.split(' ');
    //
  }
}

export { commandSignatures, buttonSignatures, Command };
