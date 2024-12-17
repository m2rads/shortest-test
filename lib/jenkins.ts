'use server'

import { JenkinsClient, CreatePipelineOptions, BuildOptions } from './jenkins/jenkins-client';

const jenkinsClient = new JenkinsClient();

export async function createJenkinsPipeline(options: CreatePipelineOptions) {
  return jenkinsClient.createPipelineJob(options);
}

export async function triggerJenkinsBuild(options: BuildOptions) {
  return jenkinsClient.triggerBuild(options);
}

export async function getJenkinsBuildStatus(jobName: string, buildNumber?: number) {
  return jenkinsClient.getBuildStatus(jobName, buildNumber);
}

export async function generateJenkinsToken(prNumber: string, branchName: string): Promise<string> {
  return jenkinsClient.generateTriggerToken(prNumber, branchName);
}

// Add more server actions as needed
