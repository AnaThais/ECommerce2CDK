import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as s3 from "@aws-cdk/aws-s3";
import * as s3n from "@aws-cdk/aws-s3-notifications";

export class InvoiceImportApplicationStack extends cdk.Stack {
  readonly urlHandler: lambdaNodeJS.NodejsFunction;
  readonly importHandler: lambdaNodeJS.NodejsFunction;

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, "InvoiceBucket", {
      bucketName: "pcs-invoices",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const invoicesDdb = new dynamodb.Table(this, "InvoicesDdb", {
      tableName: "invoices",
      billingMode: dynamodb.BillingMode.PROVISIONED,
      readCapacity: 1,
      writeCapacity: 1,
      timeToLiveAttribute: "ttl",
      partitionKey: {
        name: "pk",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "sk",
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    this.importHandler = new lambdaNodeJS.NodejsFunction(
      this,
      "InvoiceImportFunction",
      {
        functionName: "InvoiceImportFunction",
        entry: "lambda/invoiceImportFunction.js",
        handler: "handler",
        bundling: {
          minify: false,
          sourceMap: false,
        },
        tracing: lambda.Tracing.ACTIVE,
        memorySize: 128,
        timeout: cdk.Duration.seconds(30),
        environment: {
          INVOICES_DDB: invoicesDdb.tableName,
        },
      }
    );
    bucket.grantReadWrite(this.importHandler);
    invoicesDdb.grantWriteData(this.importHandler);

    bucket.addEventNotification(
      s3.EventType.OBJECT_CREATED_PUT,
      new s3n.LambdaDestination(this.importHandler)
    );

    this.urlHandler = new lambdaNodeJS.NodejsFunction(
      this,
      "InvoiceUrlFunction",
      {
        functionName: "InvoiceUrlFunction",
        entry: "lambda/invoiceUrlFunction.js",
        handler: "handler",
        bundling: {
          minify: false,
          sourceMap: false,
        },
        tracing: lambda.Tracing.ACTIVE,
        memorySize: 128,
        timeout: cdk.Duration.seconds(30),
        environment: {
          BUCKET_NAME: bucket.bucketName,
          INVOICES_DDB: invoicesDdb.tableName,
        },
      }
    );
    bucket.grantReadWrite(this.urlHandler);
    invoicesDdb.grantReadWriteData(this.urlHandler);
  }
}
