import * as cdk from "@aws-cdk/core";
import * as lambda from "@aws-cdk/aws-lambda";
import * as lambdaNodeJS from "@aws-cdk/aws-lambda-nodejs";
import * as dynamodb from "@aws-cdk/aws-dynamodb";
import * as sns from "@aws-cdk/aws-sns"; 
import * as subs from "@aws-cdk/aws-sns-subscriptions";
import { EventsDdbStack } from "./eventsDdb-stack";
import * as sqs from "@aws-cdk/aws-sqs";
import { SqsEventSource} from "@aws-cdk/aws-lambda-event-sources";

export class OrdersApplicationStack extends cdk.Stack {
  readonly ordersHandler: lambdaNodeJS.NodejsFunction;

  constructor(
        scope: cdk.Construct,
        id: string,
        productsDdb: dynamodb.Table,
        eventsDdb: dynamodb.Table,
        props?: cdk.StackProps
    ){
        super(scope, id, props);
      
        const ordersDdb = new dynamodb.Table(this, "OrdersDdb", {
            tableName: "orders",
            partitionKey: {
              name: "pk",
              type: dynamodb.AttributeType.STRING,
            },
            sortKey: {
              name: "sk",
              type: dynamodb.AttributeType.STRING,
            },
            
            removalPolicy: cdk.RemovalPolicy.DESTROY,
            billingMode: dynamodb.BillingMode.PROVISIONED,
            readCapacity: 1,
            writeCapacity: 1,
          });

          const ordersTopic = new sns.Topic(this , "OrderEventsTopic", {
            topicName: "order-events",
            displayName:"Order  events topic",    
            });

          this.ordersHandler = new lambdaNodeJS.NodejsFunction(this, "OrdersFunction", {
            functionName: "OrdersFunction",
            entry: "lambda/ordersFunction.js",
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
              ORDERS_DDB: ordersDdb.tableName,
              ORDER_EVENTS_TOPIC_ARN: ordersTopic.topicArn,
            },

            
        });
        productsDdb.grantReadData(this.ordersHandler);
        ordersDdb.grantReadWriteData(this.ordersHandler);
        ordersTopic.grantPublish(this.ordersHandler);
        
        const orderEventDlq = new sqs.Queue(this, "orderEventsDlq", {
          queueName: "order-events-dlq",
        });

        const orderEventsQueu = new sqs.Queue(this, "OrderEventsDlq", {
          queueName: "order-events",
          deadLetterQueue: {
            queue: orderEventDlq,
            maxReceiveCount: 3,
          },
        });
        ordersTopic.addSubscription(new subs.SqsSubscription(orderEventsQueu));
        // faltoou código
       ordersTopic.addSubscription( new subs.EmailSubscription("anathais@inatel.br", {
       json: true,
       filterPolicy:{
         eventType: sns.SubscriptionFilter.stringFilter({
           allowlist: ["ORDER_DELETED"],
         }),
        },

      })
    );

    const orderEventsTest = new sqs.Queue(this, "OrderEventsTest", {
      queueName: "order-events-test"
    });

    ordersTopic.addSubscription(
      new subs.SqsSubscription(orderEventsTest , {
        filterPolicy: {
          eventType: sns.SubscriptionFilter.stringFilter({
            allowlist: ["ORDER_CREATED"],
          }),
        },

      })
    );


    const orderEventsHandler = new lambdaNodeJS.NodejsFunction(this, "OrderEventsFunction", {
      functionName: "OrderEventsFuncion",
      entry: "lambda/orderEventsFunction.js",
      handler: "handler",
      bundling: {
        minify: false,
        sourceMap: false,
      },
      tracing: lambda.Tracing.ACTIVE,
      memorySize: 128,
      timeout: cdk.Duration.seconds(30),
      environment: {
        EVENTS_DDB: productsDdb.tableName,
      }
    });
   // orderEventsHandler.add
    eventsDdb.grantWriteData(orderEventsHandler);
    orderEventsQueu.grantConsumeMessages(orderEventsHandler);


  }
}