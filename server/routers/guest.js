const { Router } = require('express');
const db = require('../db');
const { asyncHandler } = require('../express-helpers');
const { groupBy } = require('../helpers');

const router = Router();

router.get('/', (_, res) => {
  res.send('This is the API for <a href="https://loved.sh">loved.sh</a>. You shouldn\'t be here!');
});

// TODO: is not needed publicly anymore. check usage
router.get('/captains', asyncHandler(async (_, res) => {
  res.json(groupBy(
    await db.queryWithGroups(`
      SELECT users.*, user_roles:roles
      FROM users
      INNER JOIN user_roles
        ON users.id = user_roles.id
      WHERE user_roles.captain_game_mode IS NOT NULL
      ORDER BY users.name ASC
    `),
    'roles.captain_game_mode',
  ));
}));

router.get('/stats/polls', asyncHandler(async (_, res) => {
  res.json(await db.queryWithGroups(`
    SELECT poll_results.*, beatmapsets:beatmapset, round_game_modes.voting_threshold
    FROM poll_results
    LEFT JOIN beatmapsets
      ON poll_results.beatmapset_id = beatmapsets.id
    LEFT JOIN round_game_modes
      ON poll_results.round = round_game_modes.round_id
        AND poll_results.game_mode = round_game_modes.game_mode
    ORDER BY poll_results.ended_at DESC
  `));
}));

router.get('/team', asyncHandler(async (_, res) => {
  const team = (await db.queryWithGroups(`
    SELECT users.*, user_roles:roles
    FROM users
    INNER JOIN user_roles
      ON users.id = user_roles.id
    ORDER BY users.name ASC
  `))
    .filter((user) => Object.entries(user.roles).some(([role, value]) => !role.startsWith('god') && value === true));

  const alumni = groupBy(
    team.filter((user) => user.roles.alumni),
    'roles.alumni_game_mode',
    undefined,
    false,
    'other',
  );

  const allCurrent = team.filter((user) => !user.roles.alumni);
  const current = groupBy(allCurrent, 'roles.captain_game_mode');
  delete current.null;

  for (const role of ['metadata', 'moderator', 'news']) {
    const usersWithRole = allCurrent.filter((user) => user.roles[role]);

    if (usersWithRole.length > 0) {
      current[role] = usersWithRole;
    }
  }

  res.json({ alumni, current });
}));

module.exports = router;
