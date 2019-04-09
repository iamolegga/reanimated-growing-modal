import React from 'react';
import {
  StyleProp,
  StyleSheet,
  TouchableWithoutFeedback,
  TouchableWithoutFeedbackProps,
  View,
  ViewStyle,
} from 'react-native';
import { PanGestureHandler, State } from 'react-native-gesture-handler';
import Animated, { Easing } from 'react-native-reanimated';

const {
  Extrapolate,
  Value,
  View: AnimatedView,
  event,
  set,
  add,
  cond,
  eq,
  greaterOrEq,
  sub,
  divide,
  call,
  or,
  createAnimatedComponent,
} = Animated;

const TouchableWithoutFeedbackAnimated = createAnimatedComponent(
  TouchableWithoutFeedback
) as React.ComponentType<TouchableWithoutFeedbackProps>;

interface IProps {
  height: number;
  paddingTopFraction: number;
  pullToClose: number;
  onClose: () => void;
  children: (
    HandlerComponent: React.ComponentType<{ children: React.ReactNode }>
  ) => React.ReactNode;
  backColor: string;
  style?: StyleProp<ViewStyle>;
}

class GrowingModal extends React.PureComponent<IProps> {
  /**
   * Animated values and constants
   */

  private paddingTop = this.props.paddingTopFraction * this.props.height;
  private animatedBack = new Value(0);
  private animatedTouch = new Value(this.props.height);
  private animatedTouchOffset = new Value(this.paddingTop);
  private animatedTouchOffsetPrev = new Value(this.paddingTop);
  private handling = new Value<number>(0);

  /**
   * GestureHandler
   */

  private onGestureEvent = event([
    {
      nativeEvent: ({
        translationY: y,
        state,
      }: {
        translationY: number;
        state: State;
      }) =>
        cond(
          // Handle only when appear animation finished and not disappearing
          eq(this.handling, 1),
          [
            // Handling active state
            cond(eq(state, State.ACTIVE), [
              // always this.animatedTouch >= 0
              set(
                this.animatedTouch,
                cond(
                  greaterOrEq(add(this.animatedTouchOffset, y), 0),
                  add(this.animatedTouchOffset, y),
                  0
                )
              ),
              // set back layer's opacity
              cond(
                greaterOrEq(this.animatedTouch, this.paddingTop),
                set(
                  this.animatedBack,
                  sub(
                    1,
                    divide(
                      sub(this.animatedTouch, this.paddingTop),
                      sub(this.props.height, this.paddingTop)
                    )
                  )
                )
              ),
            ]),

            // Handling end state
            cond(eq(state, State.END), [
              // Before setting new value for animatedTouchOffset saving
              // previous value for compare
              set(this.animatedTouchOffsetPrev, this.animatedTouchOffset),

              // Set new value of animatedTouchOffset, must be aware of sum:
              // this.animatedTouch + this.animatedTouchOffset + y
              // It must be >= 0 or:
              // animatedTouchOffset = -animatedTouch
              // as compensation
              set(
                this.animatedTouchOffset,
                cond(
                  greaterOrEq(
                    add(this.animatedTouch, this.animatedTouchOffset, y),
                    0
                  ),
                  add(this.animatedTouchOffset, y),
                  sub(0, this.animatedTouch)
                )
              ),

              // Check if should close modal
              cond(
                or(
                  // In any place moved more then "pullToClose"
                  greaterOrEq(
                    sub(this.animatedTouchOffset, this.animatedTouchOffsetPrev),
                    this.props.pullToClose
                  ),
                  // Moved lower than initial position
                  greaterOrEq(this.animatedTouchOffset, this.paddingTop)
                ),
                [
                  set(this.handling, 0),
                  call([], () => this.animateClose(this.props.onClose)),
                ]
              ),
            ]),
          ]
        ),
    },
  ]);

  /**
   * Styles
   */

  private backWrapperStyle: StyleProp<ViewStyle> = [
    StyleSheet.absoluteFill,
    {
      opacity: (this.animatedBack.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 0.8],
        extrapolate: Extrapolate.CLAMP,
      }) as any) as number,
    },
  ];

  private backInnerStyle: StyleProp<ViewStyle> = [
    styles.flexer,
    { backgroundColor: this.props.backColor },
  ];

  private wrapperStyle: StyleProp<ViewStyle> = [
    this.props.style,
    StyleSheet.absoluteFill,
    { top: (this.animatedTouch as any) as number },
  ];

  /**
   * Life Cycles
   */

  componentDidMount() {
    this.animateOpen(() => this.handling.setValue(1));
  }

  /**
   * Renders
   */

  render() {
    const { children } = this.props;

    return (
      <>
        <TouchableWithoutFeedbackAnimated
          style={this.backWrapperStyle}
          onPress={this.handleBackPress}
        >
          <View style={this.backInnerStyle} />
        </TouchableWithoutFeedbackAnimated>
        <AnimatedView style={this.wrapperStyle}>
          {children(this.GestureHandler)}
        </AnimatedView>
      </>
    );
  }

  /**
   * GestureHandler Component
   */

  private GestureHandler = (props: { children: React.ReactNode }) => {
    return (
      <PanGestureHandler
        onHandlerStateChange={this.onGestureEvent}
        onGestureEvent={this.onGestureEvent}
      >
        <AnimatedView>{props.children}</AnimatedView>
      </PanGestureHandler>
    );
  };

  /**
   * Animations
   */

  private animateOpen(cb: () => void) {
    Animated.timing(this.animatedBack, {
      duration: 600,
      toValue: 1,
      easing: Easing.out(Easing.cubic),
    }).start();

    Animated.timing(this.animatedTouch, {
      duration: 600,
      toValue: this.paddingTop,
      easing: Easing.out(Easing.cubic),
    }).start(cb);
  }

  private animateClose(cb: () => void) {
    Animated.timing(this.animatedBack, {
      duration: 300,
      toValue: 0,
      easing: Easing.in(Easing.cubic),
    }).start();

    Animated.timing(this.animatedTouch, {
      duration: 300,
      toValue: this.props.height,
      easing: Easing.in(Easing.cubic),
    }).start(cb);
  }

  /**
   * Handlers
   */

  private handleBackPress = () => {
    this.animateClose(this.props.onClose);
  };
}

const styles = StyleSheet.create({
  flexer: {
    flex: 1,
  },
});

export default GrowingModal;
