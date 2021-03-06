
import {
    SCHEMA_IDENTIFICATION,
    SCHEMA_ANNOTATIONS,
    SCHEMA_STRING_FORMATS,
    SCHEMA_COMPOSITIONS,
    SCHEMA_LOGICS
} from './schemaKWs';
import{
    SCHEMA_STRING_BUILDIN
} from './SchemaKWMapping'
import {fetchJSON} from '../utils/fetch';
import {match,merge} from '../utils/match';
import {Traverse} from "../utils/traverse";
import {Describer} from "../utils/Describer";
import {isValidHttpUrl} from "../utils/ConfigParser"

const N3 = require('n3');
const { DataFactory } = N3;
const { namedNode, literal, defaultGraph, quad } = DataFactory;
import { NamedNode,Literal, Term } from "n3/lib/N3DataFactory";
import {ConfigParser} from "../utils/ConfigParser";
import {LD_BUILD_IN_ANNOTATION} from "./LDBuildin";
import {Quad} from "n3";
import {
    blank_node_list,
    blank_node_literal,
    blank_node_namedNode,
    blank_node_node,
} from "../utils/n3_utils";


export class Schema {
    id?:string;
    config:ConfigParser;
    data:object;
    schema?:string;
    schema_type:string;
    property:string;
    annotation?:Map<string, string>;
    isClass?:boolean;
    isExisting?:boolean;
    isIgnored?:boolean;
    rdfs?:NamedNode;
    shacl?:any[];
    minItems?:number;
    maxItems?:number;
    enum?:any[];
    constructor(data: {[key:string]: any}, config, property_name:string, minItems:number=0, maxItems:number=0) {
        this.config = config;
        this.isClass = false;
        this.isExisting = false;
        this.isIgnored = false;
        this.minItems = minItems;
        this.maxItems = maxItems;
        if(data['ld.ignore']===true) this.isIgnored = true;
        if ('id' in data) this.id = data['id'];
        if ('$id' in data) this.id = data['$id'];
        if ('ld.id' in data){
            if (data['ld.class']===true){
                this.isClass = true;
                this.id = data['ld.id']
            }
            else{
                if ('ld.existing' in data){
                    this.isExisting = true;
                    this.id = data['ld.id'];
                }
                else{
                    this.id = this.config?.base_prefix + ':' + data['ld.id']
                }
            }
        }
        if(this.id === undefined){
            this.id = config.base_prefix + ':' + property_name;
        }
        if ('$schema' in data) this.schema = data['$schema']
        let ld_annotation = match(LD_BUILD_IN_ANNOTATION, data)
        let annotation = match(SCHEMA_ANNOTATIONS,data);
        this.annotation = merge(ld_annotation, annotation);
        /**
         * default, const, enum may appear in any valued JSON schema except for Null, Array and Object Schema.
         */
        let blank_list = []
        if ('default' in data) blank_list.push(blank_node_literal('sh:defaultValue', data.default));
        if ('const' in data) blank_list.push(blank_node_literal('sh:hasValue', data.const));
        if ('enum' in data) {
            let enum_list = []
            for (let ele of data['enum']){
                if (data['enum'] instanceof Array<string>)
                    enum_list.push(namedNode(this.config.base_prefix+':'+ ele));
                else
                    enum_list.push(literal(ele));
            }
            // can this be implemented by .map?
            blank_list.push(blank_node_list('sh:in',enum_list ))
            this.enum = enum_list

        }
        if (this.minItems !== 0 || this.minItems > 0 )
            blank_list.push(blank_node_literal('sh:minItems', this.minItems))

        if (this.maxItems !== 0 || this.maxItems > 0 )
            blank_list.push(blank_node_literal('sh:minItems', this.maxItems))

        this.shacl = blank_list;
    }

}

export class StringSchema extends Schema{
    constructor(data: {[key:string]: any}, config:ConfigParser,
                property_name:string, minItems:number=0, maxItems:number=0) {
        super(data,config, property_name, minItems, maxItems);
        this.schema_type = 'string';
        /* RDFS */
        if (('format' in data) && (data['format'] in SCHEMA_STRING_FORMATS)){
            this.rdfs = namedNode(SCHEMA_STRING_BUILDIN[data.format]);
        }
        else this.rdfs = namedNode('xsd:string');
        /** SHACL */
        /* SHACL minLength */
        if ('minLength' in data)
            this.shacl.push(blank_node_literal('sh:minLength', data.minLength));
        /* SHACL maxLength */
        if ('maxLength' in data)
            this.shacl.push(blank_node_literal('sh:maxLength',data.maxLength));
        /* SHACL pattern */
        if ('pattern' in data)
            this.shacl.push(blank_node_literal('sh:pattern', data.pattern));
        /* SHACL datatype */
        if ('format' in data)
            this.shacl.push(blank_node_literal('sh:datatype', SCHEMA_STRING_BUILDIN[data.format]));
        else
            this.shacl.push(blank_node_namedNode('sh:datatype', this.rdfs));
        this.schema_type = 'string'
    }

}

export class NumericSchema extends Schema{


    constructor(data: {[key:string]: any}, config:ConfigParser,
                property_name:string, minItems:number=0, maxItems:number=0) {
        super(data, config, property_name, minItems, maxItems);
        /** SHACL */
        /* SHACL minInclusive */
        if ('minimum' in data) this.shacl.push(blank_node_literal('sh:minInclusive', data.minimum));
        /* SHACL exclusiveMinimum */
        if ('exclusiveMinimum' in data) this.shacl.push(blank_node_literal('sh:minExclusive', data.exclusiveMinimum));
        /* SHACL maximum */
        if ('maximum' in data) this.shacl.push(blank_node_literal('sh:maxInclusive', data.maximum));
        /* SHACL exclusiveMaximum */
        if ('exclusiveMaximum' in data) this.shacl.push(blank_node_literal('sh:maxExclusive', data.exclusiveMaximum));

    }

}

export class IntegerSchema extends NumericSchema {
    constructor(data: {[key:string]: any}, config:ConfigParser,
                property_name:string, minItems:number=0, maxItems:number=0) {
        super(data, config, property_name, minItems, maxItems);
        this.rdfs = namedNode('xsd:integer');
        this.shacl.push(blank_node_namedNode('sh:datatype', this.rdfs));
        this.schema_type = 'integer';
    }
}

export class NumberSchema extends NumericSchema {
    constructor(data: {[key:string]: any}, config:ConfigParser,
                property_name:string, minItems:number=0, maxItems:number=0) {
        super(data, config, property_name, minItems, maxItems);
        this.rdfs = namedNode('xsd:decimal');
        this.shacl.push(blank_node_namedNode('sh:datatype', this.rdfs));
        this.schema_type = 'decimal'
    }
}

export class BooleanSchema extends Schema {
    constructor(data: {[key:string]: any}, config:ConfigParser, property_name:string,
                minItems:number=0, maxItems:number=0) {
        super(data,config, property_name, minItems, maxItems);
        this.schema_type = 'boolean';
        this.rdfs = namedNode('xsd:boolean');
        this.shacl.push(blank_node_namedNode('sh:datatype', this.rdfs));

    }
}
// Use case?
export class NullSchema extends Schema {
    constructor(data: {[key:string]: any}, config:ConfigParser, property_name:string,
                minItems:number=0, maxItems:number=0) {
        super(data,config, property_name, minItems, maxItems);
        this.schema_type = 'null';
    }
}

export class ArraySchema extends Schema {
    /**
     * In general, keywords defined in an Array schema do not hold any information except for the one tagged with ld.id.
     * When an array schema tagged with ld.id, it is interpreted as a RDFs class.
     *     items?:object|boolean;
     *     prefixItems?:Schema[];
     *     contains?:Schema;
     *     minContains?: number;
     *     maxContains?:number;
     */

    constructor(data: {[key:string]: any}, config:ConfigParser, property_name:string) {
        super(data,config, property_name);
        this.schema_type = 'array'
    }
}

export class ObjectSchema extends Schema{
    /**
     * similarly as Array schema, an object schema will be considered as a predicate except for the base one.
     *     minProperties?:number;
     *     maxProperties?:number;
     */

    constructor(data: {[key:string]: any}, config:ConfigParser, property_name:string){
        super(data,config, property_name);
    }
}

export class BaseSchema extends Schema{
    compositeOpt?:string[];
    constructor(data: {[key:string]: any}, config:ConfigParser, property_name:string){
        super(data,config, property_name);
        this.schema_type = 'base'
        }
}

/**
 *  1. how to tackle when there is a nested composition schema?
 * Example: {"allOf":[{"anyOf":[...]},{"oneOf":[]...}, {"not":{...}}}
 */
export class CompositionSchema extends Schema{
    schemas:Schema[]=[];
    schema_type:string;
    logical_opt:string;
    constructor(data: {[key:string]: any}, config, property_name:string,
                composition:string, minItems:number=0, maxItems:number=0) {
        super(data,config, property_name, minItems, maxItems);
        for (let s of data[composition]) {
            let schema;
            if (s.type === 'string')  schema = new StringSchema(s, config, property_name);
            if (s.type === 'integer') schema = new IntegerSchema(s, config, property_name );
            if (s.type === 'number')  schema = new NumberSchema(s, config, property_name);
            if (s.type === 'boolean') schema = new BooleanSchema(s, config, property_name);
            if (s.type === 'null') schema = new NullSchema(s, config, property_name);
            this.schemas.push(schema);
        }
        this.schema_type = composition;
        /**
         * Composition schema shacl: a list of blank nodes
         * ex:Shape sh:property [sh:path ex:prop; sh:and ([sh:datatype xsd:xxx; sh:xxx xxx ], [])) .
         */
        let shacl_com_list = []
        this.shacl = shacl_com_list
    }
}

export class AnyOfSchema extends CompositionSchema{
    logical_opt:string;
    constructor(data: {[key:string]: any},
                config:ConfigParser,
                composition:string='anyOf',
                property_name:string,
                minItems:number=0,
                maxItems:number=0
                ) {
        super(data,config, composition,property_name, minItems, maxItems);
        this.logical_opt = 'sh:or'
    }
}
export class OneOfSchema extends CompositionSchema{
    logical_opt:string;
    constructor(data: {[key:string]: any},
                config:ConfigParser,
                composition:string='oneOf',
                property_name:string,
                minItems:number=0,
                maxItems:number=0
    ) {
        super(data,config, composition,property_name, minItems, maxItems);
        this.logical_opt = 'sh:xone';
    }
}

export class AllOfSchema extends CompositionSchema{
    logical_opt:string;
    constructor(data: {[key:string]: any},
                config:ConfigParser,
                composition:string='allOf',
                property_name:string,
                minItems:number=0,
                maxItems:number=0
    ) {
        super(data,config, composition,property_name, minItems, maxItems);
        this.logical_opt = 'sh:and';
    }
}

export class NotSchema extends CompositionSchema{
    logical_opt:string;
    constructor(data: {[key:string]: any},
                config:ConfigParser,
                composition:string='not',
                property_name:string,
                minItems:number=0,
                maxItems:number=0
    ) {
        super(data,config, composition,property_name, minItems, maxItems);
        this.logical_opt = 'sh:not';
    }
}






export class Property{
    config:ConfigParser;
    _property_subject:string;
    _property_name:string;
    _property_schema:Schema|CompositionSchema;
    isSKOS:boolean

    constructor(
        config:ConfigParser,
        subject:string,
        property_name:string,
        property_schema:Schema|CompositionSchema,
        isSKOS:boolean=false
        //fragment:string,
        //dependent?:Property[],
        //dependsOn?:Property[]
    )
    {
        this.config = config;
        this._property_subject = subject;
        this._property_schema = property_schema;
        if (this._property_schema.id){
            this._property_name = this._property_schema.id;
        }
        else
            this._property_name = config.base_prefix+':'+property_name;


    }
    get property_subject(){
        return this._property_subject;
}

    get property_name(){
        return this._property_name;
    }
    get property_schema(){
        return this._property_schema;
    }
}


/**
 * 1. patternProperties*, -> Property?
 * 2. additionalProperties
 * 3. unevaluatedProperties
 * 4. propertyNames
 * 5. minProperties
 * 6. MaxProperties
 * 7. dependentRequired -> Property
 * 8. dependentSchemas -> Property
 * 9. required  -> Property
 *
 * Notes:
 * - sh:pattern is only applied to value nodes.
 * Thus, the equivalent expression of patternProperties in Shacl do not exist.
 *
 * - The same applies to 2-6
 *
 * - 7-9 are implemented in the Property class.
 *
 * - The sub-object type schemas server as associated blank nodes.
 * Except for their annotation e.g. description, they do not hold any useful information.
 *
 * Before 2019-09 draft dependentRequired and dependentSchemas were one keyword called dependencies.
 * To resolve the complexity among dependentRequired, dependentSchemas and dependencies, we translate the later
 * two to dependentRequired properties here.
 */
