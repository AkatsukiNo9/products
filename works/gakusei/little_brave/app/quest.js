/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Player } from './player.js';

export const QuestState = Object.freeze({
  NOT_STARTED: 0,
  IN_PROGRESS: 1,
  COMPLETED: 2, // Objective met, needs reporting
  REWARD_CLAIMED: 3,
});

// Global quest state that will be saved/loaded
export let questState = {};

const quests = {
  "monster_extermination_1": {
    id: "monster_extermination_1",
    title: "厄介な魔物退治",
    dialogs: {
        [QuestState.NOT_STARTED]: ["やあ、旅の人。東の部屋にいるオレンジ色の魔物に困っておってな。もし退治してくれたら、お礼をしよう。お願いできるかな？"],
        [QuestState.IN_PROGRESS]: ["魔物の調子はどうかな？気をつけてな。"],
        [QuestState.COMPLETED]: ["おお、見事に退治してくれたんじゃな！大したもんじゃ。これはお礼じゃ、受け取ってくれ。"],
        [QuestState.REWARD_CLAIMED]: ["あんたのおかげで村は平和じゃ。ありがとう。"]
    },
    objective: {
      type: 'kill',
      targetCount: 1,
    },
    reward: (player) => {
      player.increaseMaxHp(1);
      console.log("Quest reward given: Max HP +1");
    }
  },
  "field_cleanup_1": {
    id: "field_cleanup_1",
    title: "畑の魔物退治",
    dialogs: {
        [QuestState.NOT_STARTED]: ["旅の方、お願いがあるんだ。南の畑が魔物に荒らされて困っている。3匹ほどいるはずなんだが、退治してもらえないだろうか？お礼ははずむよ。"],
        [QuestState.IN_PROGRESS]: ["畑の魔物はどうだい？気をつけてくれよ。"],
        [QuestState.COMPLETED]: ["おお、畑の魔物を退治してくれたのかい！ありがとう、本当に助かったよ。これが約束のお礼だ、受け取ってくれ。"],
        [QuestState.REWARD_CLAIMED]: ["あんたのおかげで、畑仕事に集中できるよ。ありがとう！"]
    },
    objective: {
      type: 'kill',
      targetCount: 3,
    },
    reward: (player) => {
      player.addRupees(50);
      console.log("Quest reward given: 50 Rupees");
    }
  }
};

export function loadQuests() {
    for (const id in quests) {
        questState[id] = {
            state: QuestState.NOT_STARTED,
            currentCount: 0,
        };
    }
}

class QuestManager {
    getDialog(questId) {
        const questDef = quests[questId];
        const currentQuestState = questState[questId]?.state ?? QuestState.NOT_STARTED;
        
        return questDef?.dialogs?.[currentQuestState] ?? ["..."];
    }

    handleQuestInteraction(questId, player) {
        if (!quests[questId] || !questState[questId]) return;

        const state = questState[questId].state;

        switch(state) {
            case QuestState.NOT_STARTED:
                questState[questId].state = QuestState.IN_PROGRESS;
                console.log(`Quest "${quests[questId].title}" started.`);
                break;
            case QuestState.COMPLETED:
                quests[questId].reward(player);
                questState[questId].state = QuestState.REWARD_CLAIMED;
                break;
        }
    }
    
    checkObjective(questId) {
        if (!quests[questId] || !questState[questId]) return;
        
        const qState = questState[questId];
        if (qState.state !== QuestState.IN_PROGRESS) return;
        
        qState.currentCount++;
        
        if (qState.currentCount >= quests[questId].objective.targetCount) {
            qState.state = QuestState.COMPLETED;
            console.log(`Quest "${quests[questId].title}" objective completed!`);
        }
    }
}

export const questManager = new QuestManager();