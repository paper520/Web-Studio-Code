import keyString from '@yelloxing/core.js/tools/keyString';
import isFunction from '@yelloxing/core.js/isFunction';
import xhtml from '../xhtml';
import { getInputMessage } from './tool';

// 绑定键盘和鼠标等交互事件处理

export default function () {

    let mouseDown = false;

    // 辅助计算选择光标位置
    let calcCursor = (event) => {
        let position = xhtml.position(this._el, event);
        let topIndex = Math.round((position.y - 20.5) / 21);

        if (topIndex < 0) topIndex = 0;
        if (topIndex >= this._contentArray.length) topIndex = this._contentArray.length - 1;

        return {
            leftNum: this.$$bestLeftNum(position.x, topIndex),
            lineNum: topIndex
        };
    };

    // 获取光标之间的内容
    let calcTwoCursor = () => {

        // 假定cursor2是结束光标
        let beginCursor = this.__cursor2, endCursor = this.__cursor1;

        // 根据行号来校对
        if (this.__cursor1.lineNum < this.__cursor2.lineNum) {
            beginCursor = this.__cursor1; endCursor = this.__cursor2;
        } else if (this.__cursor1.lineNum == this.__cursor2.lineNum) {

            // 根据列号来校对
            if (this.__cursor1.leftNum < this.__cursor2.leftNum) {
                beginCursor = this.__cursor1; endCursor = this.__cursor2;
            }

            return this._contentArray[beginCursor.lineNum].substring(beginCursor.leftNum, endCursor.leftNum);
        }

        // 余下的一定是多行
        let resultData = "";
        resultData += this._contentArray[beginCursor.lineNum].substr(beginCursor.leftNum) + "\n";
        for (let lineNum = beginCursor.lineNum + 1; lineNum < endCursor.lineNum; lineNum++) {
            resultData += this._contentArray[lineNum] + "\n";
        }
        resultData += this._contentArray[endCursor.lineNum].substr(0, endCursor.leftNum);

        return resultData;

    };

    // 鼠标按下的时候，记录开始光标位置并标记鼠标按下动作
    xhtml.bind(this._el, 'mousedown', event => {
        mouseDown = true;
        this.__cursor2 = this.__cursor1 = calcCursor(event);

        this.$$updateCanvasSize();

        // 绘制选中效果
        this.$$updateSelectView();

    });

    // 移动的时候不停的同步结束光标位置
    xhtml.bind(this._el, 'mousemove', event => {
        if (!mouseDown) return;
        this.__cursor2 = calcCursor(event);

        // 绘制选中效果
        this.$$updateSelectView();

    });

    // 鼠标分开或移出的时候，标记鼠标放开
    xhtml.bind(this._el, 'mouseup', () => mouseDown = false);
    xhtml.bind(this._el, 'mouseout', () => mouseDown = false);

    // 点击编辑界面
    xhtml.bind(this._el, 'click', event => {

        this.__helpInputDOM.innerHTML = '';

        let position = xhtml.position(this._el, event);
        let topIndex = Math.round((position.y - 20.5) / 21);

        // 如果超过了内容区域
        if (topIndex < 0 || topIndex >= this._contentArray.length) return;

        this.__lineNum = topIndex;
        this.__leftNum = this.$$bestLeftNum(position.x);

        this.$$updateCursorPosition();
        this.$$updateView();
    });

    let update = text => {

        // 获取输入内容
        text = text || this.__focusDOM.value;

        text = this.$$filterText(text);

        this.__focusDOM.value = "";

        // 如果有选区，先删除选区
        if (this.$$selectIsNotBlank()) this.$$deleteSelect();

        // 如果输入的是回车，切割文本
        if (/^\n$/.test(text)) {

            if (this.__leftNum >= this._contentArray[this.__lineNum].length) {
                this._contentArray.splice(this.__lineNum + 1, 0, "");
            } else {
                this._contentArray.splice(this.__lineNum + 1, 0, this._contentArray[this.__lineNum].substring(this.__leftNum));
                this._contentArray[this.__lineNum] = this._contentArray[this.__lineNum].substring(0, this.__leftNum);
            }
            this.__lineNum += 1;
            this.__leftNum = 0;

        }

        // 否则就是一堆文本（包括复制来的）
        else {

            let textArray = text.split(/\n/);

            // 如果只有一行文本(分开是为了加速)
            if (textArray.length <= 1) {
                this._contentArray[this.__lineNum] = this._contentArray[this.__lineNum].substring(0, this.__leftNum) + text + this._contentArray[this.__lineNum].substring(this.__leftNum);
                this.__leftNum += text.length;
            }

            // 如果是复制的多行文本
            else {

                // 需要切割的行两边文本
                let leftText = this._contentArray[this.__lineNum].substring(0, this.__leftNum);
                let rightText = this._contentArray[this.__lineNum].substring(this.__leftNum);

                // 旧行文本拼接进来
                textArray[0] = leftText + textArray[0];
                textArray[textArray.length - 1] += rightText;

                // 新内容记录下来
                this._contentArray.splice(this.__lineNum, 1, ...textArray);

                this.__lineNum += (textArray.length - 1);
                this.__leftNum = textArray[textArray.length - 1].length - rightText.length;

            }

        }

        // 着色并更新视图

        this.__formatData = this.$$diff(this.$shader(this._contentArray.join('\n')));
        this.$$updateCursorPosition();
        this.$$updateView();

        // 通知文本改动
        this.__updated__();

    };

    // 中文输入开始
    xhtml.bind(this.__focusDOM, 'compositionstart', () => {
        this.__needUpdate = false;
        this.__focusDOM.style.color = "rgba(0,0,0,0)";
        this.__focusDOM.style.borderLeft = '1px solid ' + this._colorCursor;
    });

    // 中文输入结束
    xhtml.bind(this.__focusDOM, 'compositionend', () => {
        this.__needUpdate = true;
        this.__focusDOM.style.color = this._colorCursor;
        this.__focusDOM.style.borderLeft = "none";
        update();

        // 辅助输入
        if (this.$input != null) this.__helpInputEvent = this.$input(this.__helpInputDOM, getInputMessage(this), this._contentArray) || {};
    });

    // 输入
    xhtml.bind(this.__focusDOM, 'input', () => {
        // 如果是中文输入开始，不应该更新
        if (this.__needUpdate) {
            update();

            // 辅助输入
            if (this.$input != null) this.__helpInputEvent = this.$input(this.__helpInputDOM, getInputMessage(this), this._contentArray) || {};
        }
    });

    // 处理键盘控制
    xhtml.bind(this._el, 'keydown', event => {

        let keyStringCode = keyString(event);

        // 辅助输入前置拦截

        if (this.__helpInputDOM.innerHTML != '') {
            let __helpInputEvent = this.__helpInputEvent[keyStringCode];

            if (isFunction(__helpInputEvent)) {

                // 如果返回true表示继续调用，否则此快捷键结束
                if (!__helpInputEvent()) return;
            } else {
                this.__helpInputDOM.innerHTML = '';
            }
        }

        // 进入常规快捷键

        switch (keyStringCode) {

            // 全选
            case "ctrl+a": {

                // 修改选区范围
                this.__cursor1 = { leftNum: 0, lineNum: 0 };
                this.__cursor2 = { lineNum: this._contentArray.length - 1, leftNum: this._contentArray[this._contentArray.length - 1].length };

                // 绘制选中效果
                this.$$updateSelectView();

                break;
            }

            // 复制
            case "ctrl+c": {
                if (this.$$selectIsNotBlank()) {
                    xhtml.copy(calcTwoCursor());
                    this.__focusDOM.focus();
                }
                break;
            }

            // 剪切
            case "ctrl+x": {
                if (this.$$selectIsNotBlank()) {

                    xhtml.copy(calcTwoCursor());
                    this.__focusDOM.focus();
                    this.$$deleteSelect();

                    // 由于内容改变，需要重新调用着色
                    this.__formatData = this.$$diff(this.$shader(this._contentArray.join('\n')));

                    // 更新视图
                    this.$$updateCursorPosition();
                    this.$$updateView();
                    this.$$cancelSelect();

                    // 通知文本改动
                    this.__updated__();

                }
                break;
            }

            // 多空格输入或多行移位
            case "tab": {

                // tab用来控制输入多个空格，默认事件需要禁止
                xhtml.stopPropagation(event);
                xhtml.preventDefault(event);

                // 计算空格
                let blanks = "";
                for (let i = 0; i < this._tabSpace; i++) blanks += " ";

                // 如果有选区，特殊处理
                if (this.$$selectIsNotBlank()) {

                    let beginLineNum = this.__cursor1.lineNum, endLineNum = this.__cursor2.lineNum;
                    if (beginLineNum > endLineNum) {
                        beginLineNum = this.__cursor2.lineNum;
                        endLineNum = this.__cursor1.lineNum;
                    }

                    // 在开头追究tab
                    for (let lineNum = beginLineNum; lineNum <= endLineNum; lineNum++) {
                        this._contentArray[lineNum] = blanks + this._contentArray[lineNum];
                    }

                    // 校对选择区域
                    this.__cursor1.leftNum += this._tabSpace;
                    this.__cursor2.leftNum += this._tabSpace;

                    // 校对光标
                    this.__leftNum += this._tabSpace;

                    this.__formatData = this.$$diff(this.$shader(this._contentArray.join('\n')));
                    this.$$updateCursorPosition();
                    this.$$updateView();
                    this.$$updateCanvasSize();
                    this.$$updateSelectView();

                    // 通知文本改动
                    this.__updated__();

                } else {
                    update(blanks);
                }

                break;
            }

            // 光标向上
            case "up": {

                // 如果是第一行不需要任何处理
                if (this.__lineNum <= 0) return;

                // 向上一行
                this.__lineNum -= 1;

                this.__leftNum = this.$$bestLeftNum(this.$$textWidth(this._contentArray[this.__lineNum + 1].substr(0, this.__leftNum)) + 40);

                this.$$updateCursorPosition();
                this.$$updateView();
                this.$$cancelSelect();

                this._el.scrollTop -= 21;

                break;
            }

            // 光标向下
            case "down": {

                if (this.__lineNum >= this._contentArray.length - 1) return;

                // 向下一行
                this.__lineNum += 1;

                this.__leftNum = this.$$bestLeftNum(this.$$textWidth(this._contentArray[this.__lineNum - 1].substr(0, this.__leftNum)) + 40);

                this.$$updateCursorPosition();
                this.$$updateView();
                this.$$cancelSelect();

                this._el.scrollTop += 21;

                break;
            }

            // 光标向左
            case "left": {

                if (this.__leftNum <= 0) {
                    if (this.__lineNum <= 0) return;
                    this.__lineNum -= 1;
                    this.__leftNum = this._contentArray[this.__lineNum].length;
                } else {
                    this.__leftNum -= 1;
                }

                this.$$updateCursorPosition();
                this.$$cancelSelect();

                break;
            }

            // 光标向右
            case "right": {

                if (this.__leftNum >= this._contentArray[this.__lineNum].length) {
                    if (this.__lineNum >= this._contentArray.length - 1) return;
                    this.__lineNum += 1;
                    this.__leftNum = 0;
                } else {
                    this.__leftNum += 1;
                }

                this.$$updateCursorPosition();
                this.$$cancelSelect();

                break;
            }

            // 删除
            case "backspace": {

                // 如果有选区
                if (this.$$selectIsNotBlank()) {

                    // 删除选区
                    this.$$deleteSelect();

                }

                // 无选区的常规操作
                else {
                    if (this.__leftNum <= 0) {
                        if (this.__lineNum <= 0) return;

                        this.__lineNum -= 1;
                        this.__leftNum = this._contentArray[this.__lineNum].length;

                        // 一行的开头应该删除本行（合并到前一行）
                        this._contentArray[this.__lineNum] += this._contentArray[this.__lineNum + 1];
                        this._contentArray.splice(this.__lineNum + 1, 1);

                    } else {
                        this.__leftNum -= 1;
                        this._contentArray[this.__lineNum] = this._contentArray[this.__lineNum].substring(0, this.__leftNum) + this._contentArray[this.__lineNum].substring(this.__leftNum + 1);
                    }
                }

                // 由于内容改变，需要重新调用着色
                this.__formatData = this.$$diff(this.$shader(this._contentArray.join('\n')));

                // 更新视图
                this.$$updateCursorPosition();
                this.$$updateView();
                this.$$cancelSelect();

                // 通知文本改动
                this.__updated__();

                break;
            }
        }

    });

};