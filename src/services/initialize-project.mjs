import fs from 'fs';
import path from 'path';
import {
  FIGMA_CURSOR_RULES_DIR,
  FIGMA_MEMORY_BANK_DIR,
  FIGMA_TASK_MANAGEMENT_RULE_FILE_NAME,
  PROMPT_TYPE,
} from '../constant.mjs';
import getConfig from '../config.mjs';
import { getTaskFileName } from './utils.mjs';
import { getPromptByIdAjax } from './api.mjs';

/**
 * 写入 figma-task-management-rule.mdc 文件
 * @param {string} workspaceRoot - 工作区根目录
 * @param {string} projectName - 项目名称
 * @param {string} projectType - 项目类型
 * @param {boolean} isReset - 是否重置项目
 * @returns {Promise<Object>} - 写入的文件路径
 */
const handleWriteTaskManagementRule = async (
  workspaceRoot,
  projectName,
  projectType,
  isReset
) => {
  const targetDir = path.join(workspaceRoot, FIGMA_CURSOR_RULES_DIR);
  const targetFile = path.join(targetDir, FIGMA_TASK_MANAGEMENT_RULE_FILE_NAME);
  const isExists = fs.existsSync(targetFile);

  if (isReset || !isExists) {
    // 确保目标目录存在
    await fs.promises.mkdir(targetDir, { recursive: true });

    // 读取模板内容
    const tasksRuleResponse = await getPromptByIdAjax(
      projectType,
      PROMPT_TYPE.TASKS_RULE,
      projectName
    );
    if (
      tasksRuleResponse.status === 'error' ||
      !tasksRuleResponse.data.prompt
    ) {
      throw new Error('获取 Figma 任务执行规则失败');
    }

    // 写入目标文件
    await fs.promises.writeFile(
      targetFile,
      tasksRuleResponse.data.prompt,
      'utf8'
    );
  }

  return {
    isExists,
    targetFile,
  };
};

/**
 * 写入 task.json 文件
 * @param {string} projectRoot - 项目根目录
 * @param {string} projectName - 项目名称
 * @param {string} projectType - 项目类型
 * @param {boolean} isReset - 是否重置项目
 * @returns {Promise<Object>} - 写入的文件路径
 */
const handleWriteFigmaTaskFile = async (
  projectRoot,
  projectName,
  projectType,
  isReset
) => {
  const targetFile = path.join(
    projectRoot,
    FIGMA_MEMORY_BANK_DIR,
    getTaskFileName(projectType)
  );

  // 如果目标文件不存在, 写入目标文件
  const isExists = fs.existsSync(targetFile);
  if (isReset || !isExists) {
    // 确保目标目录存在
    await fs.promises.mkdir(path.dirname(targetFile), { recursive: true });

    // 读取模板内容
    const tasksResponse = await getPromptByIdAjax(
      projectType,
      PROMPT_TYPE.TASKS,
      projectName
    );
    if (tasksResponse.status === 'error' || !tasksResponse.data.prompt) {
      throw new Error('获取 Figma 任务流Prompt失败');
    }

    // 写入目标文件
    await fs.promises.writeFile(targetFile, tasksResponse.data.prompt, 'utf8');
  }

  return {
    isExists,
    targetFile,
  };
};

/**
 * 初始化项目结构
 * @param {boolean} isReset - 是否重置项目
 * @returns {Promise<Object>} - 初始化项目结构
 */
export const initializeProjectService = async (isReset) => {
  const figmaConfig = getConfig();
  try {
    const {
      isExists: taskManagementRuleIsExists,
      targetFile: taskManagementRuleFilePath,
    } = await handleWriteTaskManagementRule(
      figmaConfig.workspaceRoot,
      figmaConfig.projectName,
      figmaConfig.projectType,
      isReset
    );
    const { isExists: figmaTaskIsExists, targetFile: figmaTaskFilePath } =
      await handleWriteFigmaTaskFile(
        figmaConfig.projectRoot,
        figmaConfig.projectName,
        figmaConfig.projectType,
        isReset
      );

    return {
      status: 'success',
      data: `初始化 figma2code 项目成功
      1. ${
        isReset
          ? '文件已重置'
          : taskManagementRuleIsExists
          ? '文件已存在'
          : '生成'
      } ${taskManagementRuleFilePath}
      2. ${
        isReset ? '文件已重置' : figmaTaskIsExists ? '文件已存在' : '生成'
      } ${figmaTaskFilePath}
      `,
    };
  } catch (error) {
    return { status: 'error', error: error.message };
  }
};
