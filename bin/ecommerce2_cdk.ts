#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { Ecommerce2CdkStack } from '../lib/ecommerce2_cdk-stack';
import { PipelineStack } from '../lib/pipeline/pipeline-stack';

const app = new cdk.App();
new PipelineStack(app, "PipelineStack", {
  env: {
    account: "962173486310",
    region: "us-east-1",
  },
  tags: {
    ["const"]:  "ECommerce",
    ["team"]: "AnaThais",
  },

});
app.synth();
