import axios from 'axios';
import { PROJECT_TYPE_PROMPT_ID } from '../constant.mjs';

/**
 * 获取 Figma 任务提示
 * @param {*} projectType - 项目类型
 * @param {*} promptType - 提示类型
 * @param {*} projectName - 项目名称
 * @returns {Promise<Object>} - Figma 任务提示
 */
export const getPromptByIdAjax = async (
  projectType,
  promptType,
  projectName
) => {
  const response = await axios.post(
    `https://d2c.tongdao.cn/api/prompt/getFeaipubPrompt`,
    {
      promptId: PROJECT_TYPE_PROMPT_ID[projectType][promptType],
      projectType,
      context: {
        projectName,
      },
    }
  );
  return response.data;
};
