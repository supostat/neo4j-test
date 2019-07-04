const neo4j = require('neo4j-driver').v1;
import faker from 'faker';
import createUsers from './factories/user.factory';
import { randomInteger } from './utils';

const USERS_COUNT = 100;
const MIN_FRIENDS = 3;
const MAX_FRIENDS = 10;

const MIN_RELATIONS_COUNT = 1;
const MAX_RELATIONS_COUNT = 19;

function uniquenessGenerator(count, getFieldFunction) {
  const set = new Set();
  while (set.size !== count) {
    const generatedValue = getFieldFunction();
    set.add(generatedValue);
  }
  return Array.from(set);
}

function buildCreatePersonsQuery(persons) {
  return persons
    .map(person => {
      const { firstName, lastName, phoneNumber } = person;
      const personHead = `${firstName}${lastName}`.replace(/[^A-Za-z]/g, '');
      return `CREATE (${personHead}:Person {name: '${firstName.replace(
        /[^A-Za-z]/g,
        ''
      )} ${lastName.replace(/[^A-Za-z]/g, '')}', firstName:'${firstName.replace(
        /[^A-Za-z]/g,
        ''
      )}', lastName:'${lastName.replace(
        /[^A-Za-z]/g,
        ''
      )}', phoneNumber:'${phoneNumber}'})`;
    })
    .join('\n');
}

function buildRelationsQuery(persons) {
  return persons
    .map(person => {
      const { firstName, lastName, friends } = person;
      const personHead = `${firstName}${lastName}`.replace(/[^A-Za-z]/g, '');
      if (friends.length === 0) {
        console.log('friends', friends);
      }
      const friendRelationQuery = friends.map(
        ({ friendId, relationsCount }) => {
          const friend = persons.find(person => person.id === friendId);
          const { firstName, lastName } = friend;
          const fHead = `${firstName}${lastName}`.replace(/[^A-Za-z]/g, '');
          if (!relationsCount) {
            console.log('relationsCount', relationsCount);
          }
          const relationsIds = [...Array(relationsCount).keys()];
          const relationQuery = relationsIds
            .map(id => {
              return `(${personHead})-[:REL_${id + 1}]->(${fHead})`;
            })
            .join(',');
          return relationQuery;
        }
      );
      return 'CREATE' + friendRelationQuery;
    })
    .join('\n');
}

function generateUserFriends(user, users) {
  const result = uniquenessGenerator(
    randomInteger(MIN_FRIENDS, MAX_FRIENDS),
    () => {
      return randomInteger(1, users.length);
    }
  ).filter(friendId => friendId !== user.id);
  if (result.length === 0) {
    return generateUserFriends(user, users);
  } else {
    return result;
  }
}

function generateUsers() {
  const phoneNumbers = uniquenessGenerator(USERS_COUNT, () => {
    return faker.phone.phoneNumber('8(999)###-##-##');
  });

  const fullNames = uniquenessGenerator(USERS_COUNT, () => {
    return `${faker.name.firstName()} ${faker.name.lastName()}`;
  });

  const users = createUsers(USERS_COUNT, {
    firstName: fullNames,
    lastName: fullNames,
    phoneNumber: phoneNumbers
  });
  const usersWithFriends = users.map(user => {
    const userFriends = generateUserFriends(user, users);

    return {
      ...user,
      friends: userFriends.map(friendId => ({
        friendId,
        relationsCount: randomInteger(MIN_RELATIONS_COUNT, MAX_RELATIONS_COUNT)
      }))
    };
  });

  return usersWithFriends;
}

async function fillDB(usersWithFriends) {
  const createPersonsQuery = buildCreatePersonsQuery(usersWithFriends);
  const relationsQuery = buildRelationsQuery(usersWithFriends);
  console.log('createPersonsQuery');
  // console.log(createPersonsQuery)
  console.log('---------');
  console.log('relationsQuery');
  // console.log(relationsQuery)

  const driver = neo4j.driver(
    'bolt://localhost',
    neo4j.auth.basic('neo4j', '1234')
  );
  const session = driver.session();
  try {
    await session.run('MATCH (n) DETACH DELETE n'); //clean db
    const result = await session.run(`
        ${createPersonsQuery}
        ${relationsQuery}
    `);
    console.log('Success');
  } catch (error) {
    console.log('Error: ', error);
  } finally {
    session.close();
    driver.close();
  }
}

async function main() {
  const users = generateUsers();
  await fillDB(users);
}

main();
