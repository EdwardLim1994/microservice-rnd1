import type { GraphQLResolveInfo } from 'graphql';
import type { PayrollGraphqlContextType } from './context';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type RequireFields<T, K extends keyof T> = Omit<T, K> & { [P in K]-?: NonNullable<T[P]> };
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string; }
  String: { input: string; output: string; }
  Boolean: { input: boolean; output: boolean; }
  Int: { input: number; output: number; }
  Float: { input: number; output: number; }
  _FieldSet: { input: unknown; output: unknown; }
};

export type PayrollRecord = {
  __typename?: 'PayrollRecord';
  dailyRate: Scalars['Float']['output'];
  deduction: Scalars['Float']['output'];
  employeeId: Scalars['ID']['output'];
  generatedAt: Scalars['String']['output'];
  id: Scalars['ID']['output'];
  month: Scalars['Int']['output'];
  monthlyRate: Scalars['Float']['output'];
  netAmount: Scalars['Float']['output'];
  unpaidDays: Scalars['Int']['output'];
  year: Scalars['Int']['output'];
};

export type PayrollRecordListResult = {
  __typename?: 'PayrollRecordListResult';
  records: Array<PayrollRecord>;
  total: Scalars['Int']['output'];
};

export type Query = {
  __typename?: 'Query';
  myPayrollRecords: PayrollRecordListResult;
  payrollPdfUrl: Scalars['String']['output'];
};


export type QueryMyPayrollRecordsArgs = {
  page?: InputMaybe<Scalars['Int']['input']>;
  pageSize?: InputMaybe<Scalars['Int']['input']>;
  year?: InputMaybe<Scalars['Int']['input']>;
};


export type QueryPayrollPdfUrlArgs = {
  payrollRecordId: Scalars['ID']['input'];
};

export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;

export type ReferenceResolver<TResult, TReference, TContext> = (
      reference: TReference,
      context: TContext,
      info: GraphQLResolveInfo
    ) => Promise<TResult> | TResult;

      type ScalarCheck<T, S> = S extends true ? T : NullableCheck<T, S>;
      type NullableCheck<T, S> = Maybe<T> extends T ? Maybe<ListCheck<NonNullable<T>, S>> : ListCheck<T, S>;
      type ListCheck<T, S> = T extends (infer U)[] ? NullableCheck<U, S>[] : GraphQLRecursivePick<T, S>;
      export type GraphQLRecursivePick<T, S> = { [K in keyof T & keyof S]: ScalarCheck<T[K], S[K]> };
    

export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = Record<PropertyKey, never>, TParent = Record<PropertyKey, never>, TContext = Record<PropertyKey, never>, TArgs = Record<PropertyKey, never>> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping of federation types */
export type FederationTypes = ResolversObject<{
  PayrollRecord: PayrollRecord;
}>;

/** Mapping of federation reference types */
export type FederationReferenceTypes = ResolversObject<{
  PayrollRecord:
    ( { __typename: 'PayrollRecord' }
    & GraphQLRecursivePick<FederationTypes['PayrollRecord'], {"id":true}> );
}>;



/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  PayrollRecord: ResolverTypeWrapper<PayrollRecord>;
  Float: ResolverTypeWrapper<Scalars['Float']['output']>;
  ID: ResolverTypeWrapper<Scalars['ID']['output']>;
  String: ResolverTypeWrapper<Scalars['String']['output']>;
  Int: ResolverTypeWrapper<Scalars['Int']['output']>;
  PayrollRecordListResult: ResolverTypeWrapper<PayrollRecordListResult>;
  Query: ResolverTypeWrapper<Record<PropertyKey, never>>;
  Boolean: ResolverTypeWrapper<Scalars['Boolean']['output']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  PayrollRecord: PayrollRecord | FederationReferenceTypes['PayrollRecord'];
  Float: Scalars['Float']['output'];
  ID: Scalars['ID']['output'];
  String: Scalars['String']['output'];
  Int: Scalars['Int']['output'];
  PayrollRecordListResult: PayrollRecordListResult;
  Query: Record<PropertyKey, never>;
  Boolean: Scalars['Boolean']['output'];
}>;

export type PayrollRecordResolvers<ContextType = PayrollGraphqlContextType, ParentType extends ResolversParentTypes['PayrollRecord'] = ResolversParentTypes['PayrollRecord'], FederationReferenceType extends FederationReferenceTypes['PayrollRecord'] = FederationReferenceTypes['PayrollRecord']> = ResolversObject<{
  __resolveReference?: ReferenceResolver<Maybe<ResolversTypes['PayrollRecord']> | FederationReferenceType, FederationReferenceType, ContextType>;
  dailyRate?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  deduction?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  employeeId?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  generatedAt?: Resolver<ResolversTypes['String'], ParentType, ContextType>;
  id?: Resolver<ResolversTypes['ID'], ParentType, ContextType>;
  month?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  monthlyRate?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  netAmount?: Resolver<ResolversTypes['Float'], ParentType, ContextType>;
  unpaidDays?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
  year?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type PayrollRecordListResultResolvers<ContextType = PayrollGraphqlContextType, ParentType extends ResolversParentTypes['PayrollRecordListResult'] = ResolversParentTypes['PayrollRecordListResult']> = ResolversObject<{
  records?: Resolver<Array<ResolversTypes['PayrollRecord']>, ParentType, ContextType>;
  total?: Resolver<ResolversTypes['Int'], ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = PayrollGraphqlContextType, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  myPayrollRecords?: Resolver<ResolversTypes['PayrollRecordListResult'], ParentType, ContextType, Partial<QueryMyPayrollRecordsArgs>>;
  payrollPdfUrl?: Resolver<ResolversTypes['String'], ParentType, ContextType, RequireFields<QueryPayrollPdfUrlArgs, 'payrollRecordId'>>;
}>;

export type Resolvers<ContextType = PayrollGraphqlContextType> = ResolversObject<{
  PayrollRecord?: PayrollRecordResolvers<ContextType>;
  PayrollRecordListResult?: PayrollRecordListResultResolvers<ContextType>;
  Query?: QueryResolvers<ContextType>;
}>;

