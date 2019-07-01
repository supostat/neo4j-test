const neo4j = require('neo4j-driver').v1;
const driver = neo4j.driver("bolt://localhost", neo4j.auth.basic("neo4j", "12345"));
const session = driver.session();
// console.log(session)

import faker from 'faker';

import createUsers from './factories/user.factory';
import { randomInteger } from './utils'

const USERS_COUNT = 2000;
const MIN_FRIENDS = 3;
const MAX_FRIENDS = 10;

function uniquenessGenerator(count, getFieldFunction) {
  const set = new Set();
  while (set.size !== count) {
    const generatedValue = getFieldFunction(set);
    set.add(generatedValue)
  }
  return Array.from(set);
}

const phoneNumbers = uniquenessGenerator(USERS_COUNT, () => {
  return faker.phone.phoneNumber("8(999)###-##-##");
});

const fullNames = uniquenessGenerator(USERS_COUNT, () => {
  return `${faker.name.firstName()} ${faker.name.lastName()}`;
})

const users = createUsers(USERS_COUNT, { firstName: fullNames, lastName: fullNames, phoneNumber: phoneNumbers });

const usersWithFriends = users.map(user => {
  const userFriends = uniquenessGenerator(randomInteger(MIN_FRIENDS, MAX_FRIENDS), () => {
    return randomInteger(1, users.length);
  });

  return {
    ...user,
    friendsIds: userFriends.filter(friendId => friendId !== user.id),
  };
})

async function createPersons(persons) {
  const personQuery = persons.map((person, personIndex) => {
    const { firstName, lastName, friendsIds, phoneNumber } = person;
    const personHead = `${firstName}${lastName}`.replace(/[^A-Za-z]/g, '');
    return `CREATE (${personHead}:Person {name: '${firstName.replace(/[^A-Za-z]/g, '')} ${lastName.replace(/[^A-Za-z]/g, '')}', firstName:'${firstName.replace(/[^A-Za-z]/g, '')}', lastName:'${lastName.replace(/[^A-Za-z]/g, '')}', phoneNumber:'${phoneNumber}'})`
  }).join("\n");
  const friendsQuery = persons.map((person, personIndex) => {
    const { firstName, lastName, friendsIds, phoneNumber } = person;
    const isPersonLast = personIndex === persons.length - 1;
    const personHead = `${firstName}${lastName}`.replace(/[^A-Za-z]/g, '');
    return friendsIds.map((friendId, friendIndex) => {
      const isFriendLast = friendIndex === friendsIds.length - 1;
      const friend = persons.find(person => person.id === friendId);
      const { firstName, lastName } = friend;
      const fHead = `${firstName}${lastName}`.replace(/[^A-Za-z]/g, '');
      if (isPersonLast && isFriendLast) {
        return `(${personHead})-[:FRIEND_WITH]->(${fHead})`;
      }
      return `(${personHead})-[:FRIEND_WITH]->(${fHead}),`;
    })
  }).flat().join("\n");

  try {
    const result = await session.run(`
        ${personQuery}
        CREATE
        ${friendsQuery}
    `);
    console.log(result)
  } catch (error) {
    console.log(error)
  }
  return 'DONE';
}

async function createPersonsRelations(persons) {
  for await (let user of persons) {
    const { firstName, lastName, friendsIds, phoneNumber } = user;
    const userHead = `${firstName}${lastName}`.replace(/[^A-Za-z]/g, '');
    const friendsHeads = friendsIds.map(friendId => {
      const friend = persons.find(person => person.id === friendId);
      const { firstName, lastName } = friend;
      return `${firstName}${lastName}`.replace(/[^A-Za-z]/g, '');
    })
    try {
      const result = await session.run(`
        CREATE
          ${friendsHeads.map((fHead, index) => {
        const isLast = index === friendsHeads.length - 1;
        if (isLast) {
          return `(${userHead})-[:FRIEND_WITH]->(${fHead})`;
        }
        return `(${userHead})-[:FRIEND_WITH]->(${fHead}),`;
      }).join("\n")}
      `);
      console.log(result)
    } catch (error) {
      console.log(error)
    }
  }
}
(async function name(params) {
  await createPersons(usersWithFriends);
  console.log('DONE');
  // await createPersonsRelations(usersWithFriends);
  session.close();
})();
