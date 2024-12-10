// utils/jenkins-creator.ts

export interface CreatePipelineOptions {
    branchName: string;
    prNumber: string;
    repoUrl: string;
  }

export interface BuildOptions {
    jobName: string;
    token?: string;
    parameters?: Record<string, string>;
}
  
export class JenkinsClient {
    private jenkinsUrl: string;
    private auth: string;
  
    constructor() {
      this.jenkinsUrl = process.env.JENKINS_URL || '';
      const credentials = `${process.env.JENKINS_USER}:${process.env.JENKINS_API_TOKEN}`;
      this.auth = Buffer.from(credentials).toString('base64');
    }
  
    async createPipelineJob({ branchName, prNumber, repoUrl }: CreatePipelineOptions) {
      // Sanitize the job name
      const sanitizedBranchName = branchName.replace(/[^a-zA-Z0-9-_]/g, '_');
      const jobName = `PR-${prNumber}-${sanitizedBranchName}`;
      const configXml = this.generateJobConfig({ branchName, repoUrl });

      try {
        // Create new job
        const createResponse = await fetch(`${this.jenkinsUrl}/createItem?name=${encodeURIComponent(jobName)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
            'Authorization': `Basic ${this.auth}`,
          },
          body: configXml,
        });

        if (!createResponse.ok) {
          const errorBody = await createResponse.text();
          console.error('Jenkins API Error:', {
            status: createResponse.status,
            statusText: createResponse.statusText,
            body: errorBody,
          });
          throw new Error(`Failed to create pipeline: ${createResponse.statusText}. Body: ${errorBody}`);
        }

        // Enable remote triggers and set token
        const triggerToken = this.generateTriggerToken(prNumber, branchName);
        await this.configureTriggerToken(jobName, triggerToken);

        return {
          jobName,
          triggerToken,
          buildUrl: `${this.jenkinsUrl}/job/${jobName}/build?token=${triggerToken}`,
        };
      } catch (error) {
        console.error('Error creating pipeline:', error);
        throw error;
      }
    }
  
    private generateJobConfig({ branchName, repoUrl }: Partial<CreatePipelineOptions>): string {
      return `<?xml version='1.0' encoding='UTF-8'?>
      <flow-definition plugin="workflow-job">
        <actions/>
        <description>Pipeline for ${branchName}</description>
        <keepDependencies>false</keepDependencies>
        <properties>
          <org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
            <triggers>
              <org.jenkinsci.plugins.workflow.job.properties.RemoteBuildProperty>
                <remoteToken>TRIGGER_TOKEN_PLACEHOLDER</remoteToken>
              </org.jenkinsci.plugins.workflow.job.properties.RemoteBuildProperty>
            </triggers>
          </org.jenkinsci.plugins.workflow.job.properties.PipelineTriggersJobProperty>
        </properties>
        <definition class="org.jenkinsci.plugins.workflow.cps.CpsScmFlowDefinition" plugin="workflow-cps">
          <scm class="hudson.plugins.git.GitSCM" plugin="git">
            <configVersion>2</configVersion>
            <userRemoteConfigs>
              <hudson.plugins.git.UserRemoteConfig>
                <url>${repoUrl}</url>
              </hudson.plugins.git.UserRemoteConfig>
            </userRemoteConfigs>
            <branches>
              <hudson.plugins.git.BranchSpec>
                <name>*/${branchName}</name>
              </hudson.plugins.git.BranchSpec>
            </branches>
          </scm>
          <scriptPath>Jenkinsfile</scriptPath>
        </definition>
      </flow-definition>`;
    }
  
    public generateTriggerToken(prNumber: string, branchName: string): string {
      // Generate a unique token - you might want to use a more secure method
      return `pr-${prNumber}-${branchName}-${Date.now()}`;
    }
  
    private async configureTriggerToken(jobName: string, token: string) {
      const configUrl = `${this.jenkinsUrl}/job/${jobName}/config.xml`;
      
      try {
        // Get current config
        const getResponse = await fetch(configUrl, {
          headers: {
            'Authorization': `Basic ${this.auth}`,
          },
        });
        
        let config = await getResponse.text();
        
        // Update token in config
        config = config.replace('TRIGGER_TOKEN_PLACEHOLDER', token);
        
        // Update job config
        const updateResponse = await fetch(configUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/xml',
            'Authorization': `Basic ${this.auth}`,
          },
          body: config,
        });
  
        if (!updateResponse.ok) {
          throw new Error('Failed to update trigger token');
        }
      } catch (error) {
        console.error('Error configuring trigger token:', error);
        throw error;
      }
    }

    async triggerBuild({ jobName, token, parameters = {} }: BuildOptions) {
        try {
          // Determine if we should use buildWithParameters or build
          const hasParams = Object.keys(parameters).length > 0;
          const endpoint = hasParams ? 'buildWithParameters' : 'build';
          
          // Construct the URL
          let url = `${this.jenkinsUrl}/job/${jobName}/${endpoint}`;
          
          // Add token if provided
          if (token) {
            url += `?token=${token}`;
          }
    
          // Add parameters if any
          if (hasParams) {
            const params = new URLSearchParams(parameters);
            url += token ? '&' : '?';
            url += params.toString();
          }
    
          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Authorization': `Basic ${this.auth}`,
              'Content-Type': 'application/json',
            },
          });
    
          if (!response.ok) {
            throw new Error(`Failed to trigger build: ${response.statusText}`);
          }
    
          // Get the queue item URL from the Location header
          const queueItemUrl = response.headers.get('Location');
    
          return {
            success: true,
            jobName,
            queueItemUrl,
            message: `Build triggered for ${jobName}`,
          };
        } catch (error) {
          console.error(`Error triggering build for ${jobName}:`, error);
          throw error;
        }
    }
    
    async getBuildStatus(jobName: string, buildNumber?: number) {
    try {
        let url = `${this.jenkinsUrl}/job/${jobName}`;
        if (buildNumber) {
        url += `/${buildNumber}`;
        }
        url += '/api/json';

        const response = await fetch(url, {
        headers: {
            'Authorization': `Basic ${this.auth}`,
        },
        });

        if (!response.ok) {
        throw new Error(`Failed to get build status: ${response.statusText}`);
        }

        const data = await response.json();
        return data;
    } catch (error) {
        console.error(`Error getting build status for ${jobName}:`, error);
        throw error;
    }
    }
}
