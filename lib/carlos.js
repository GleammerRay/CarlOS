import { REST, Gateway } from './gleamcord.js';
import * as Fs from 'fs';
import * as Path from 'path';

var commandSignatures = [];
var buttonSignatures = [];
const commandsPath = Path.join(Path.dirname(process.argv[1]), 'lib', 'commands')
const commandFiles = Fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
var commands = [];
for (const file of commandFiles) {
  if (file == 'common.js') continue;
  const command = await import(Path.join(commandsPath, file));
  if (command.commandSignatures != null) {
    for (const signature of command.commandSignatures) {
      commandSignatures.push(signature);
    }
  }
  if (command.buttonSignatures != null) {
    for (const signature of command.buttonSignatures) {
      buttonSignatures.push(signature);
    }
  }
  commands.push(command);
}

export class BurstStack {
  #active;
  #paused;
  #currentTimeout;
  #timeout;
  #stack;

  constructor(timeout, stack = null) {
    this.#active = false;
    this.#paused = false;
    this.#timeout = timeout;
    if (stack == null) stack = {};
    this.#stack = stack;
  }

  set(name, command) {
    this.#stack[name] = command;
    if (this.#paused) {
      this.#paused = false;
      this.#currentTimeout = setTimeout(() => this._mainLoop(), this.#timeout);
    }
  }
  
  get(name) {
    return this.#stack[name];
  }

  remove(name) {
    delete this.#stack[name];
  }

  _mainLoop() {
    var _stack = Object.values(this.#stack);
    if (_stack.length == 0) {
      this.#paused = true;
      return;
    }
    this.#stack = {};
    _stack.forEach((value) => value());
    if (!this.#active) return;
    this.#currentTimeout = setTimeout(() => this._mainLoop(), this.#timeout);
  }

  start() {
    if (this.#active) return;
    this.#active = true;
    this._mainLoop();
  }

  stop() {
    this.#active = false;
    this.#paused = false;
    clearTimeout(this.#currentTimeout);
    this.#currentTimeout = undefined;
    Object.values(this.#stack).forEach((value) => value());
    this.#stack = {};
  }
}

export class BurstStackManager {
  #stacks;

  constructor() {
    this.#stacks = {};
  }

  get(frequency) {
    var stack = this.#stacks[frequency];
    if (stack == null) {
      stack = new BurstStack(frequency);
      stack.start();
      this.#stacks[frequency] = stack;
    }
    return stack;
  }

  start() {
    for (const stack of Object.values(this.#stacks)) {
      stack.start();
    }
  }

  stop() {
    for (const stack of Object.values(this.#stacks)) {
      stack.stop();
    }
  }
}

var burstStacksStarted = false;
const burstStackManager = new BurstStackManager();
burstStackManager.get(10000);

export const startBurstStacks = () => {
  burstStacksStarted = true;
  burstStackManager.start();
}

export const stopBurstStacks = () => {
  burstStacksStarted = false;
  burstStackManager.stop();
}

process.on('SIGINT', () => stopBurstStacks());
process.on('SIGTERM', () => stopBurstStacks());

class CarlOSDB {
  #timeout;
  #entries;
  #newEntries;
  #scheduledRemoval;
  #dbPath;

  constructor(path) {
    process.on('SIGINT', () => clearTimeout(this.#timeout));
    process.on('SIGTERM', () => clearTimeout(this.#timeout));
    this.#dbPath = path;
    this.#entries = {};
    this.#newEntries = {};
    this.#scheduledRemoval = {};
    this._schedule();
  }

  _schedule() {
    this.#scheduledRemoval = this.#newEntries;
    this.#newEntries = {};
    this.#timeout = setTimeout(() => this._remove(), 30000);
  };

  _remove() {
    Object.keys(this.#scheduledRemoval).forEach((name) => delete this.#entries[name]);
    this.#scheduledRemoval = {};
    this.#timeout = setTimeout(() => this._schedule(), 30000);
  }

  _register(name, data) {
    this.#entries[name] = data;
    this.#newEntries[name] = null;
  }

  get(name, template = undefined) {
    name = name.replace('/', Path.sep);
    const path = Path.join(this.#dbPath, name);
    var data = this.#entries[path];
    if (data === undefined) {
      if (Fs.existsSync(path)) {
        data = JSON.parse(Fs.readFileSync(path, 'utf8'));
      } else {
        return template;
      }
    }
    if (this.#scheduledRemoval[path] != null) {
      delete this.#scheduledRemoval[path];
    }
    this._register(path, data);
    return data;
  }

  set(name, data) {
    name = name.replace('/', Path.sep);
    const path = Path.join(this.#dbPath, name);
    const dirname = Path.dirname(path);
    if (this.#scheduledRemoval[path] != null) {
      delete this.#scheduledRemoval[path];
    }
    this._register(path, data);
    if (!Fs.existsSync(dirname)) {
      Fs.mkdirSync(dirname, { recursive: true });
    }
    Fs.writeFileSync(path, JSON.stringify(data));
  }

  /*
  remove(name) {
    if (this.#entries[name] === undefined) return;
    delete this.#entries[name];
    delete this.#newEntries[name];
    delete this.#scheduledRemoval[name];
  }
  */
}

class CommandInitOptions {
  rest;
  db;
  burstStackManager;

  constructor(rest, db, burstStackManager) {
    this.rest = rest;
    this.db = db;
    this.burstStackManager = burstStackManager;
  }
}

const snakeToCamel = str => str.replace( /([-_]\w)/g, g => g[ 1 ].toUpperCase() );

const snakeToPascal = str => {
  let camelCase = snakeToCamel( str );
  let pascalCase = camelCase[ 0 ].toUpperCase() + camelCase.substr( 1 );
  return pascalCase;
}

const simpleStringMatchAccuracy = (a, b) => {
  var _bIndex = 0;
  if (b.length == 0) return;
  for (let i = 0; i != a.length; i++) {
    if (a[i] == b[_bIndex]) {
      _bIndex++;
      if (_bIndex == b.length) return _bIndex;
      continue;
    }
    _bIndex = 0;
  }
  return _bIndex;
}

const linearStringMatchAccuracy = (a, b) => {
  var _bIndex = 0;
  if (b.length == 0) return;
  for (let i = 0; i != a.length; i++) {
    if (a[i] != b[_bIndex]) break;
    _bIndex++;
    if (_bIndex == b.length) return _bIndex;
  }
  return _bIndex;
}

const addMilliseconds = (date, milliseconds) => {
  return new Date(date.getTime() + milliseconds);
}

const ranInt = (start, end) => {
  return start + Math.round((Math.random() * (end - start)));
}

const getInteractionResponse = (data, type = 4) => {
  return `{"type":${type},"data":${JSON.stringify(data)}}`;
}

const getEphemeralResponse = (content) => {
  return getInteractionResponse({flags: 1 << 6, content: content});
}

const getSimpleModal = (title, customID, component) => {
  return {
    title: title,
    custom_id: customID,
    components: [{
      type: 1,
      components: [component]
    }]
  };
}

const dmUsers = (rest, userIDs, message) => {
  if (userIDs.length == 0) return;
  rest.createDMMessage(userIDs[0], message);
  return setTimeout(() => dmUsers(rest, userIDs.slice(1), message), 500);
}

const ghostPingUsers = async (rest, channelID, userIDs) => {
  if (userIDs.length == 0) return;
  var _message = `<@${userIDs[0]}>`
  async function _ghostPing(rest) {
    _message = await rest.createMessage(channelID, `{"content":"${_message}"}`);
    if (_message != null) if (_message.id != null) await rest.deleteMessage(channelID, _message.id);
  }
  for (let i = 1; i < userIDs.length; i++) {
    // Maximum of 95 mentions per ping
    if ((i % 95) == 0) {
      await _ghostPing(rest);
      _message = '';
    }
    _message += `<@${userIDs[i]}>`;
  }
  await _ghostPing(rest);
}

export const CarlOSEventType = {
  Warned: 'Warned',
  Kicked: 'Kicked',
  Banned: 'Banned',
}

export class CarlOSEvent {
  playerID;
  team;
  type;
  message;

  constructor(playerID, team, type, message) {
    this.playerID = playerID;
    this.team = team;
    this.type = type;
    this.message = message;
  }
}

export class CarlOS {
  #isRunning;
  #botToken;
  #ownerID;
  #rest;
  #gateway;
  #dbPath;
  #db;
  #commands;

  constructor(botToken, ownerID, dbPath) {
    this.#dbPath = dbPath;
    this.#db = new CarlOSDB(dbPath);
    this.#botToken = botToken;
    this.#rest = REST.fromBotToken(this.#botToken);
    var botCommands = {};
    const commandInitOptions = new CommandInitOptions(this.#rest, this.#db, burstStackManager);
    for (var command of commands) {
      const botCommand = new command.Command(commandInitOptions);
      for (const signature of command.commandSignatures) {
        botCommands[signature.name] = botCommand;
      }
    }

    this.#ownerID = ownerID;
    this.#commands = botCommands;
  }

  static fromENV() {
    var dbPath = process.env.CARLOS_PREFS_PATH;
    var ownerID = process.env.CARLOS_OWNER_ID;
    var botToken = process.env.CARLOS_BOT_TOKEN;
    if (dbPath == null || dbPath == '') {
      throw { name: 'EnvPrefsPath', message: 'Environment variable CARLOS_PREFS_PATH is missing.' };
    }
    if (botToken == null || botToken == '') {
      throw { name: 'EnvBotToken', message: 'Environment variable CARLOS_BOT_TOKEN is missing.' };
    }
    if (ownerID == null || ownerID == '') {
      throw { name: 'EnvOwnerID', message: 'Environment variable CARLOS_OWNER_ID is missing.' };
    }
    var carlOS = new CarlOS(botToken, ownerID, dbPath);
    return carlOS;
  }

  _onInteractionError(interaction, message) {
    if (message != null) {
      console.log('E:');
      console.log(message);
    }
    return this.#rest.createInteractionResponse(interaction, getEphemeralResponse('Whoops! There appears to be a problem on our side. :exploding_head:'));
  }

  sendPermissionDenied(interaction) {
    return this.#rest.createInteractionResponse(interaction, getEphemeralResponse('Permission denied. :lock:'));
  }

  executeInteraction(interaction) {
    var commandName;
    if (interaction.data.custom_id == null) {
      commandName = interaction.data.name;
      const command = this.#commands[commandName];
      if (command != null) {
        return command.execute(interaction);
      }
    }
    else {
      commandName = interaction.data.custom_id.split(' ')[0];
      const command = this.#commands[commandName];
      if (command != null) {
        return command.executeButton(interaction);
      }
    }
    return this._onInteractionError(interaction, interaction.data);
  }

  async _onOpen() {
    console.log('I:Discord gateway opened.');
  }

  async _onReady(data) {
    console.log('I:Setting application commands.');;
    return await this.#rest.bulkOverwriteGlobalApplicationCommands(data.application.id, JSON.stringify(commandSignatures));
  }

  _onMessage(event) {
    var _data = JSON.parse(event.data);
    if (_data.op == null) return;
    switch (_data.op) {
    case 0:
      var _msg = `I:Received Opcode 0 from Discord:` + _data.t;
      if (_data.t == 'INTERACTION_CREATE') {
        var _interaction = _data.d.data;
        //console.log(`${_msg}:${_interaction.name}.`);
        this.executeInteraction(_data.d);
        return;
      }
      if (_data.t == 'READY') {
        this._onReady(_data.d);
        return;
      }
      console.log(`${_msg}.`);
      return;
    case 7:
      console.log('I:Received Opcode 7 Reconnect from Discord.');
      return;
    case 9:
      console.log('I:Received Opcode 9 Invalid Session from Discord.')
      return;
    case 10:
      console.log('I:Received Opcode 10 Hello from Discord.');
      return;
    case 11:
      //console.log('I:Received Opcode 11 Heartbeat ACK from Discord.');
      return;
    default:
      console.log(`W:Received unknown data from Discord:\n${JSON.stringify(_data)}`);
      return;
    }
  }

  _onClose(event) {
    var _msg = 'I:Discord gateway connection closed.';
    if (event.reason == '') {
      console.log(_msg);
      return;
    }
    console.log(`${_msg} Reason:${event.reason}.`);
  }

  _onError(event) {
    console.log(`E:Discord gateway connection closed abnormally:${event.error}.`);
  }

  _onHeartbeat(interval) {
    //console.log(`I:Sending Opcode 1 Heartbeat to Discord after ${interval}ms.`);
  }

  async start() {
    if (this.#isRunning) {
      throw { name: 'BotRunning', message: 'The bot is already running.' };
    }
    console.log('I:Starting bot.');
    this.#isRunning = true;
    if (!burstStacksStarted) startBurstStacks();
    console.log('I:Connecting to Discord gateway.');
    if (this.#gateway == null) {
      this.#gateway = new Gateway(
        (await this.#rest.getGatewayURL()).url,
        this.#botToken,
        0,
        'linux',
        'CarlOS',
        'CarlOS',
      );
      this.#gateway.onOpen = (event) => this._onOpen(event);
      this.#gateway.onMessage = (event) => this._onMessage(event);
      this.#gateway.onClose = (event) => this._onClose(event);
      this.#gateway.onError = (event) => this._onError(event);
      this.#gateway.onHeartbeat = (event) => this._onHeartbeat(event);
    }
    await this.#gateway.open();
  }

  stop() {
    console.log('I:Stopping.');
    this.#isRunning = false;
    console.log('I:Closing Discord gateway.');
    this.#gateway.close();
  }
}
