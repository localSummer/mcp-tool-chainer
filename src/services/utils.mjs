import {
  FIGMA_TASK_FILE_NAME,
  FIGMA_TASK_FILE_NAME_FLUTTER,
  FIGMA_TASK_FILE_NAME_UNI2,
  PROJECT_TYPE,
  TASK_STATUS_OPTIONS,
} from '../constant.mjs';

/**
 * 检查给定的状态是否为有效的任务状态
 * @param {string} status - 要检查的状态
 * @returns {boolean} 如果状态有效，返回 true，否则返回 false
 */
export function isValidTaskStatus(status) {
  return TASK_STATUS_OPTIONS.includes(status);
}

/**
 * 构建 key 到 number 的映射关系
 * @param {Array} tasks - 任务列表
 * @returns {Map<string, string>} - key 到 number 的映射
 */
export const buildKeyToNumberMap = (tasks) => {
  const keyToNumberMap = new Map();
  tasks.forEach((task) => {
    if (task.key && task.number !== undefined) {
      keyToNumberMap.set(task.key, String(task.number));
    }
    if (Array.isArray(task.subtasks)) {
      task.subtasks.forEach((subtask) => {
        if (subtask.key && subtask.number !== undefined) {
          keyToNumberMap.set(subtask.key, String(subtask.number));
        }
      });
    }
  });
  return keyToNumberMap;
};

/**
 * 将 key 转换为对应的 number
 * @param {string} key - 任务或子任务的 key
 * @param {Map<string, string>} keyToNumberMap - key 到 number 的映射
 * @returns {string|null} - 对应的 number，如果找不到则返回 null
 */
export const resolveKeyToNumber = (key, keyToNumberMap) => {
  return keyToNumberMap.get(key) || null;
};

/**
 * 规范化任务状态，统一小写并提供默认值
 * @param {string} statusStr - 原始状态字符串
 * @returns {string} - 规范化后的状态字符串
 */
export const getNormalizedStatus = (statusStr) =>
  (statusStr || 'pending').toLowerCase();

/**
 * 通过 key 或 number 查找任务
 * @param {string} identifier - 任务的 key 或 number
 * @param {Array} tasks - 任务列表
 * @param {Map<string, string>} keyToNumberMap - key 到 number 的映射
 * @returns {Object|null} - 找到的任务对象，包含任务信息和类型
 */
export const findTaskByKeyOrNumber = (identifier, tasks, keyToNumberMap) => {
  // 首先尝试作为 key 查找
  const numberFromKey = resolveKeyToNumber(identifier, keyToNumberMap);
  const targetNumber = numberFromKey || identifier;

  // 检查是否为子任务 (包含小数点)
  if (targetNumber.includes('.')) {
    const [parentNumber, subtaskNumber] = targetNumber
      .split('.')
      .map((num) => parseInt(num, 10));

    const parentTask = tasks.find((t) => t.number === parentNumber);
    if (!parentTask || !parentTask.subtasks) {
      return null;
    }

    const subtask = parentTask.subtasks.find(
      (st) => st.number === subtaskNumber
    );
    if (!subtask) {
      return null;
    }

    return {
      type: 'subtask',
      task: subtask,
      parentTask: parentTask,
      fullNumber: targetNumber,
    };
  } else {
    // 查找父任务
    const taskNumber = parseInt(targetNumber, 10);
    const task = tasks.find((t) => t.number === taskNumber);

    if (!task) {
      return null;
    }

    return {
      type: 'task',
      task: task,
      parentTask: null,
      fullNumber: targetNumber,
    };
  }
};

/**
 * 检查任务的前置条件是否满足
 * @param {Object} task - 任务对象
 * @param {Array} allTasks - 所有任务列表
 * @param {Map<string, string>} keyToNumberMap - key 到 number 的映射
 * @returns {Object} - 前置条件检查结果
 */
export const checkPreconditions = (task, allTasks, keyToNumberMap) => {
  if (!task.precondition || task.precondition.length === 0) {
    return { satisfied: true, unsatisfiedDeps: [] };
  }

  const unsatisfiedDeps = [];

  for (const depKey of task.precondition) {
    const depNumber = resolveKeyToNumber(depKey, keyToNumberMap);
    if (!depNumber) {
      unsatisfiedDeps.push({ key: depKey, reason: 'Task not found' });
      continue;
    }

    const depTaskInfo = findTaskByKeyOrNumber(
      depNumber,
      allTasks,
      keyToNumberMap
    );
    if (!depTaskInfo) {
      unsatisfiedDeps.push({ key: depKey, reason: 'Task not found' });
      continue;
    }

    const depStatus = (depTaskInfo.task.status || 'pending').toLowerCase();
    if (depStatus !== 'done' && depStatus !== 'completed') {
      unsatisfiedDeps.push({
        key: depKey,
        number: depNumber,
        currentStatus: depTaskInfo.task.status || 'pending',
        reason: 'Not completed',
      });
    }
  }

  return {
    satisfied: unsatisfiedDeps.length === 0,
    unsatisfiedDeps,
  };
};

/**
 * 收集所有已完成的任务和子任务的number
 * @param {Array} tasks - 要扫描的任务列表
 * @returns {Set<string>} - 已完成任务number的集合
 */
export const collectCompletedNumbers = (tasks) => {
  const completedNumbers = new Set();
  tasks.forEach((t) => {
    if (['done', 'completed'].includes(getNormalizedStatus(t.status))) {
      completedNumbers.add(String(t.number));
    }
    if (Array.isArray(t.subtasks)) {
      t.subtasks.forEach((st) => {
        if (['done', 'completed'].includes(getNormalizedStatus(st.status))) {
          completedNumbers.add(String(st.number));
        }
      });
    }
  });
  return completedNumbers;
};

/**
 * 根据项目类型获取任务文件名
 * @param {string} projectType - 项目类型
 * @returns {string} - 任务文件名
 */
export const getTaskFileName = (projectType) => {
  switch (projectType) {
    case PROJECT_TYPE.REACT:
      return FIGMA_TASK_FILE_NAME;
    case PROJECT_TYPE.UNI2:
      return FIGMA_TASK_FILE_NAME_UNI2;
    case PROJECT_TYPE.FLUTTER:
      return FIGMA_TASK_FILE_NAME_FLUTTER;
    default:
      return FIGMA_TASK_FILE_NAME;
  }
};
