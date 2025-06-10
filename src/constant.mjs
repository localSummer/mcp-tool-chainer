/**
 * Figma 记忆库目录
 */
export const FIGMA_MEMORY_BANK_DIR = 'memory-bank/figma2code';

/**
 * Figma React 任务文件名
 */
export const FIGMA_TASK_FILE_NAME = 'task.json';

/**
 * Figma Uni2 任务文件名
 */
export const FIGMA_TASK_FILE_NAME_UNI2 = 'task-uni2.json';

/**
 * Figma Flutter 任务文件名
 */
export const FIGMA_TASK_FILE_NAME_FLUTTER = 'task-flutter.json';

/**
 * Figma 任务管理规则文件名
 */
export const FIGMA_TASK_MANAGEMENT_RULE_FILE_NAME =
  'figma-task-management-rule.mdc';

/**
 * Figma cursor 规则目录
 */
export const FIGMA_CURSOR_RULES_DIR = '.cursor/rules';

/**
 * 项目类型
 */
export const PROJECT_TYPE = {
  REACT: 'react',
  UNI2: 'uni2',
  FLUTTER: 'flutter',
};

/**
 * 项目类型对应的 prompt 类型
 */
export const PROMPT_TYPE = {
  CODE: 'code',
  STORYBOOK: 'storybook',
  TASKS: 'tasks',
  TASKS_RULE: 'tasks-rule',
};

/**
 * 项目类型对应的 promptId
 */
export const PROJECT_TYPE_PROMPT_ID = {
  [PROJECT_TYPE.REACT]: {
    [PROMPT_TYPE.TASKS_RULE]: '6847aa26605f7d005901bdbe',
    [PROMPT_TYPE.CODE]: '682439e8bd174f005b7708ab',
    [PROMPT_TYPE.STORYBOOK]: '683edf53605f7d00590189a3',
    [PROMPT_TYPE.TASKS]: '68478f71605f7d005901bcc6',
  },
  [PROJECT_TYPE.FLUTTER]: {
    [PROMPT_TYPE.TASKS_RULE]: '6847aa26605f7d005901bdbe',
    [PROMPT_TYPE.CODE]: '68414cc3605f7d00590197e9',
    [PROMPT_TYPE.TASKS]: '684794ee605f7d005901bcfb',
  },
  [PROJECT_TYPE.UNI2]: {
    [PROMPT_TYPE.TASKS_RULE]: '6847aa26605f7d005901bdbe',
    [PROMPT_TYPE.CODE]: '684795fc605f7d005901bd16',
    [PROMPT_TYPE.TASKS]: '6847956d605f7d005901bd05',
  },
};

/**
 * @typedef {'pending' | 'done' | 'in-progress' | 'review' | 'deferred' | 'cancelled'} TaskStatus
 */

/**
 * 任务状态选项列表
 * @type {TaskStatus[]}
 * @description 定义可能的任务状态:
 * - pending: 任务等待开始
 * - done: 任务完成
 * - in-progress: 任务进行中
 * - review: 任务完成并等待审核
 * - deferred: 任务推迟或暂停
 * - cancelled: 任务取消且不会完成
 */
export const TASK_STATUS_OPTIONS = [
  'pending',
  'done',
  'in-progress',
  'review',
  'deferred',
  'cancelled',
];
