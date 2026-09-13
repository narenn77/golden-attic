import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, ActivityIndicator, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';

import LoginScreen from '../screens/LoginScreen';
import SignupScreen from '../screens/SignupScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import BrowseScreen from '../screens/BrowseScreen';
import ListingDetailScreen from '../screens/ListingDetailScreen';
import CreateListingScreen from '../screens/CreateListingScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import ProfileScreen from '../screens/ProfileScreen';
import SellerOnboardingScreen from '../screens/SellerOnboardingScreen';
import MyListingsScreen from '../screens/MyListingsScreen';

const Stack = createNativeStackNavigator();

// A single stack for everyone - browsing (Browse, ListingDetail) never
// requires an account. Screens that do require one (CreateListing,
// Checkout, Profile, SellerOnboarding) are only ever reached via a header
// button or in-screen action that's itself hidden while logged out, and
// each of those screens also shows its own "please log in" fallback as a
// second line of defense.
export default function RootNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#B8860B" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerTintColor: '#B8860B' }}>
        <Stack.Screen
          name="Browse"
          component={BrowseScreen}
          options={({ navigation }) => ({
            title: 'Golden Attic',
            headerRight: () => (
              <TouchableOpacity onPress={() => navigation.navigate(user ? 'Profile' : 'Login')}>
                <Text style={styles.headerLink}>{user ? 'Profile' : 'Log in'}</Text>
              </TouchableOpacity>
            ),
            headerLeft: user
              ? () => (
                  <TouchableOpacity onPress={() => navigation.navigate('CreateListing')}>
                    <Text style={styles.headerLink}>Sell</Text>
                  </TouchableOpacity>
                )
              : undefined,
          })}
        />
        <Stack.Screen name="ListingDetail" component={ListingDetailScreen} options={{ title: 'Item' }} />
        <Stack.Screen name="Checkout" component={CheckoutScreen} options={{ title: 'Checkout' }} />
        <Stack.Screen name="CreateListing" component={CreateListingScreen} options={{ title: 'Sell an Item' }} />
        <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
        <Stack.Screen name="MyListings" component={MyListingsScreen} options={{ title: 'My Listings' }} />
        <Stack.Screen name="SellerOnboarding" component={SellerOnboardingScreen} options={{ title: 'Payout Setup' }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Log In', headerShown: false }} />
        <Stack.Screen name="Signup" component={SignupScreen} options={{ title: 'Sign Up', headerShown: false }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  headerLink: { color: '#B8860B', fontSize: 15, fontWeight: '600', paddingHorizontal: 8 },
});
