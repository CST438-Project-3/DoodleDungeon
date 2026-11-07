# Product Requirements Document (PRD): Doodle Dungeon (temp name).

**Team:** Team 06 · **Repo:** https://github.com/CST438-Project-3/DoodleDungeon · **Last updated:** 10/28/2026

---

## 1. Users
Who is this for? Name one primary user type and describe them in one or two sentences. "Everyone" and "students" are not user types; "a first-year student looking for a study group for one specific course" is.

- **Primary user:** Students who need a quick break from coursework and want casual, asynchronous strategic competition with their peers.
- **Secondary user (optional):** An administrator who can moderate inappropriate user-drawn guardian art (Possibly? Might be too much to implement Admin, will need to talk to team).

## 2. Problem
Two sentences: what the user struggles with today, and why existing options fall short.

Existing drawing games you play with friends, like jackbox titles, require all members to be present and playing together, which can be hard for some users who can't meet up in real life or have different time zones that makes it hard to arrange meetings. With our simple game, it allows users to play against their friends even when they aren't online by setting up custom dungeons with their drawn guardians for others to raid asynchronously.

## 3. Success measures
Three measurable signals that would show the product works. Each one needs a number and a way to check it.

| # | Measure | Target | How we check it |
| :--- | :--- | :--- | :--- |
| **S1** | A new user draws and saves their first custom guardian | under 2 minutes | timed during the onboarding test |
| **S2** | A player initiates and resolves an asynchronous dungeon raid | under 1 minute | timed during the dry run |
| **S3** | The server evaluates a 3-room gauntlet matchup | < 500 milliseconds | verified via API logs |

## 4. Scope: MVP, vertical slice, and not building
MVP is the smallest set of stories that makes this product useful. It always includes the account baseline (sign in with Google, update profile, delete account) plus the stories specific to your product.

- **MVP stories:** PRD-1, PRD-2, PRD-3, PRD-4, PRD-5
- **Vertical slice:** A user draws a new guardian, assigns it a class (Warrior, Brawler, Ranger, or Mage), and saves it to their roster.
- **Not building (this term):** Real-time WebSockets, in-game currency or microtransactions, pathfinding/animations, and an iOS client.

## 5. User stories and acceptance criteria
One row per MVP story. Each GitHub issue links to its story ID (PRD-3) and each story has at least one acceptance criterion in Given / When / Then form that someone outside the team could test.

| ID | Story | Acceptance criteria |
| :--- | :--- | :--- |
| **PRD-1** | As a player, I want to sign in with Google so my roster inventory is saved securely. | Given I am signed out, when I authenticate via the provider, then my profile is created in the database and I see my dashboard. |
| **PRD-2** | As a player, I want to draw a custom guardian and pick a class so I can build my dungeon defenders and raiding party. | Given I am on the creation screen, when I submit a drawing and select a class, then the new guardian appears in my inventory. |
| **PRD-3** | As a player, I want to assign three guardians to my dungeon rooms so I can defend against attackers. | Given I have at least three guardians, when I slot them into sequential rooms 1, 2, and 3, then my dungeon defense layout is updated. |
| **PRD-4** | As an attacker, I want to raid a friend's dungeon so I can test my heroes against their setup. | Given I select a target player's dungeon, when I submit my raiding party, then the server resolves the sequential room encounters and returns a battle log. |
| **PRD-5** | As a user, I want to delete my account so my data is removed. | Given I am signed in, when I click delete account, then my profile, guardians, and dungeon are wiped and I am logged out. |

## Change log

| Date | PR | What changed and why |
| :--- | :--- | :--- |
| 10/28/2026 | #1 | Initial version |
