/// <reference path="../../typings/debug.d.ts" />
/**
 * Created by liuxi on 2019/01/31.
 */
import {EventEmitter} from 'events';
import {Option} from "../../typings/provider";


class Provider extends EventEmitter {
    constructor(option: Option) {
        super();

    }


}


export {Provider};
export default {};
