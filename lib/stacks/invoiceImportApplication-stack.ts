import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as s3 from "@aws-cdk/aws-s3";
import * as s3n from "@aws-cdk/aws-s3-notifications";
import * as sqs from "@aws-cdk/aws-sqs";
import { DynamoEventSource, SqsDlq } from "@aws-cdk/aws-lambda-event-sources";

export class InvoiceImportApplicationStack extends cdk.Stack {
  readonly urlHandler: lambdaNodeJS.NodejsFunction;
  readonly importHandler: lambdaNodeJS.NodejsFunction;

  constructor(
    scope: cdk.Construct,
    id: string,
    eventsDdb: dynamodb.Table,
    props?: cdk.StackProps
  ) {
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
      stream: dynamodb.StreamViewType.NEW_AND_OLD_IMAGES,
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
    invoicesDdb.grantReadWriteData(this.importHandler);

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

    const invoiceEventsHandler = new lambdaNodeJS.NodejsFunction(
      this,
      "InvoiceEventsFunction",
      {
        functionName: "InvoiceEventsFunction",
        entry: "lambda/invoiceEventsFunction.js",
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

    const invoiceEventsDlq = new sqs.Queue(this, "InvoiceEventsDlq", {
      queueName: "invoice-events-dlq",
    });

    invoiceEventsHandler.addEventSource(
      new DynamoEventSource(invoicesDdb, {
        startingPosition: lambda.StartingPosition.TRIM_HORIZON,
        batchSize: 5,
        bisectBatchOnError: true,
        onFailure: new SqsDlq(invoiceEventsDlq),
        retryAttempts: 3,
      })
    );

    eventsDdb.grantWriteData(invoiceEventsHandler);
  }
}
