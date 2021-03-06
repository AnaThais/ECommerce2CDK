import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as dynamodb from "@aws-cdk/aws-dynamodb";

export class ProductsFunctionStack extends cdk.Stack {
  readonly handler: lambdaNodeJS.NodejsFunction;

  constructor(
    scope: cdk.Construct,
    id: string,
    productsDdb: dynamodb.Table,
    productEventsFunction: lambdaNodeJS.NodejsFunction,
    props?: cdk.StackProps
  ) {
    super(scope, id, props);

    this.handler = new lambdaNodeJS.NodejsFunction(this, "ProductsFunction", {
      functionName: "ProductsFunction",
      entry: "lambda/productsFunction.js",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      environment: {
        PRODUCTS_DDB: productsDdb.tableName,
        PRODUCT_EVENTS_FUNCTION_NAME: productEventsFunction.functionName,
      },
    });

    productsDdb.grantReadWriteData(this.handler);
    productEventsFunction.grantInvoke(this.handler);
  }
}
