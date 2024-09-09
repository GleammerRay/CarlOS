const defaultReportTopics = [
  'spam',
  'nsfw',
  'harassment',
];

const defaultSettings = {
  topics: defaultReportTopics,
  reportChannelId: null,
};

const defaultThreads = {
  threads: {},
};

const defaultUsers = {
  users: {},
}

class User {
  #db;
  #dbPath;
  #id;
  #alive; // : bool - Is user a current member.
  #reportsReceivedCount; // : int? - Number of reports received.
  #reportsSentCount; // : int? - Number of reports sent.
  #warningsReceivedCount; // : int? - Number of warnings received.
  #warningsSentCount; // : int? - Number of warnings sent.

  get id() {
    return this.#id;
  }

  get alive() {
    return this.#alive;
  }

  set alive(val) {
    this.#alive = val;
  }

  get reportsReceivedCount() {
    const val = this.#reportsReceivedCount;
    if (val == null) return 0;
    return val;
  }

  set reportsReceivedCount(val) {
    if (val == 0) val = null;
    this.#reportsReceivedCount = val;
  }

  get reportsSentCount() {
    const val = this.#reportsSentCount;
    if (val == null) return 0;
    return val;
  }

  set reportsSentCount(val) {
    if (val == 0) val = null;
    this.#reportsSentCount = val;
  }

  get warningsReceivedCount() {
    const val = this.#warningsReceivedCount;
    if (val == null) return 0;
    return val;
  }

  set warningsReceivedCount(val) {
    if (val == 0) val = null;
    this.#warningsReceivedCount = val;
  }

  get warningsSentCount() {
    const val = this.#warningsSentCount;
    if (val == null) return 0;
    return val;
  }

  set warningsSentCount(val) {
    if (val == 0) val = null;
    this.#warningsSentCount = val;
  }

  constructor(id, alive = true, reportsReceivedCount, reportsSentCount, warningsReceivedCount, warningsSentCount) {
    this.#id = id;
    if (alive == null) alive = true;
    this.#alive = alive;
    this.#reportsReceivedCount = reportsReceivedCount;
    this.#reportsSentCount = reportsSentCount;
    this.#warningsReceivedCount = warningsReceivedCount;
    this.#warningsSentCount = warningsSentCount;
  }

  static fromDB(db, dbPath, id) {
    const users = db.get(dbPath, defaultUsers);
    var user = users.users[id];
    if (user == null) user = { alive: true };
    const result = new User(id, user.alive, user.reportsReceivedCount, user.reportsSentCount, user.warningsReceivedCount, user.warningsSentCount);
    result.#db = db;
    result.#dbPath = dbPath;
    return result;
  }

  save() {
    var users = this.#db.get(this.#dbPath, defaultUsers);
    var user = {
      alive: this.#alive,
    };
    if (this.#reportsReceivedCount != null) user.reportsReceivedCount = this.#reportsReceivedCount;
    if (this.#reportsSentCount != null) user.reportsSentCount = this.#reportsSentCount;
    if (this.#warningsReceivedCount != null) user.warningsReceivedCount = this.#warningsReceivedCount;
    if (this.#warningsSentCount != null) user.warningsSentCount = this.#warningsSentCount;
    users.users[this.#id] = user;
    this.#db.set(this.#dbPath, users);
  }
}

const defaultEmbedColor = 0xA5A5A5;
const defaultLogoURL = 'https://raw.github.com/GleammerRay/CarlOS/master/assets/logo.png?refresh';
const defaultEmbedAuthor = {
  name: 'CarlOS',
  url: 'https://github.com/GleammerRay/CarlOS',
  icon_url: defaultLogoURL,
};

const defaultEmbedFooter = {
  icon_url: 'https://cdn.discordapp.com/attachments/1005272489380827199/1005581705035399198/gleam.jpg',
  text: 'Made by Gleammer (nice)',
};

const buildEmbed = embed => {
  if (embed.title == undefined) embed.title = 'CarlOS';
  if (embed.footer == undefined) embed.footer = defaultEmbedFooter;
  if (embed.thumbnail == undefined) embed.thumbnail = { url: defaultLogoURL };
  if (embed.author == undefined) embed.author = defaultEmbedAuthor;
  if (embed.color == undefined) embed.color = defaultEmbedColor;
  return embed;
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

const truncate = (str, n) => {
  return (str.length > n) ? str.slice(0, n-1) + '&hellip;' : str;
};

const isAdmin = (member) => {
  return (member.permissions & (1 << 3)) == (1 << 3);
}

const postThreadReport = async (db, rest, dbPath, reportChannelId, key, threadName, reportData) => {
  var threads = db.get(dbPath, defaultThreads);
  var threadId = threads.threads[key];
  if (threadId != null) {
    const channel = await rest.getChannel(threadId);
    if (channel.id == null) {
      if (channel.code != 10003) {
        return;
      }
      delete threads.threads[key];
      db.set(dbPath, threads);
      threadId = null;
    }
  }
  if (threadId == null) {
    const thread = await rest.startThread(reportChannelId, threadName, 60);
    if (thread.id != null) {
      threadId = thread.id;
      threads.threads[key] = threadId;
      db.set(dbPath, threads);
    }
  }
  if (threadId != null) {
    return await rest.createMessage(threadId, reportData);
  }
}

export { defaultReportTopics, defaultSettings, defaultThreads, defaultUsers, User, buildEmbed, snakeToCamel, snakeToPascal, simpleStringMatchAccuracy, linearStringMatchAccuracy, truncate, isAdmin, postThreadReport };
