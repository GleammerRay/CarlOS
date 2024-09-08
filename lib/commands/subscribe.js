import * as common from '../common.js';
Object.assign(global, common);

const commandSignatures = [
  {
    name: 'subscribe',
    description: 'Subscribe channel to user reports',
    dm_permission: false,
    type: 1,
    default_member_permissions: '0',
    default_permission: false,
  },
];

const buttonSignatures = [
  {
    id: 'subscribe confirm',
  },
  {
    id: 'subscribe cancel',
  },
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
    return this.rest.createEphemeralInteractionResponse(interaction, {
      content: 'Subscribe this channel to user reports?',
      components: [
        {
          type: 1,
          components: [
            {
              type: 2,
              custom_id: 'subscribe cancel',
              label: `Cancel`,
              style: 4,
            },
            {
              type: 2,
              custom_id: 'subscribe confirm',
              label: `Confirm`,
              style: 1,
            },
          ],
        },
      ],
    });
  }

  async executeButton(interaction) {
    var settings = this.db.get(`guilds/${interaction.guild_id}/settings.json`, defaultSettings);
    const customId = interaction.data.custom_id.split(' ');
    if (customId.length < 2) return;
    const choice = customId[1];
    if (choice == 'confirm') {
      const response = await this.rest.createMessage(interaction.channel_id, { embeds: [buildEmbed({ description: 'New user reports will appear here. :sunrise_over_mountains:' })] });
      console.log(response);
      if (response.id == null) return await this.rest.createInteractionResponse(interaction, `{"type":4,"data":{"flags":${1 << 6},"content":"Couldn't send the server list. Are you sure you gave proper message permissions to me? :thinking:"}}`);
      if (response.channel_id == null) return await this.rest.createInteractionResponse(interaction, `{"type":4,"data":{"flags":${1 << 6},"content":"Couldn't send the server list, are you sure you gave proper message permissions to me? :thinking:"}}`);
      const channelId = response.channel_id;
      settings.reportChannelId = channelId;
      this.db.set(`guilds/${interaction.guild_id}/settings.json`, settings);
      return this.rest.updateInteractionResponse(interaction, { content: `Channel <#${response.channel_id}> will now be used for user reports. :mailbox:`, components: [] });
    } else {
      return this.rest.updateInteractionResponse(interaction, { content: `Subscription cancelled. :sleeping:`, components: [] });
    }
  }
}

export { commandSignatures, buttonSignatures, Command };
