import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as dynamodb from "@aws-cdk/aws-dynamodb";

export class ProductEventsFetchsFunctionStack extends cdk.Stack {
  readonly handler: lambdaNodeJS.NodejsFunction;

  constructor(
    scope: cdk.Construct,
    id: string,
    eventsDdb: dynamodb.Table,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    this.handler = new lambdaNodeJS.NodejsFunction(
      this,
      "ProductEventsFetchFunction",
      {
        functionName: "ProductEventsFetchFunction",
        entry: "lambda/productEventsFetchFunction.js",
        handler: "handler",
        bundling: {
          minify: false,
          sourceMap: false,
        },
        tracing: lambda.Tracing.ACTIVE,
        memorySize: 128,
        timeout: cdk.Duration.seconds(30),
        environment: {
          EVENTS_DDB: eventsDdb.tableName,
        },
      }
    );
    eventsDdb.grantReadData(this.handler);
  }
}