import { StyleSheet, Text, View, TextInput, TouchableOpacity, Image, FlatList, ActivityIndicator, Platform } from 'react-native'
import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter, useLocalSearchParams } from 'expo-router'
import { collection, query, orderBy, limit, startAfter, doc, getDoc, Query, QuerySnapshot, DocumentData, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { icons } from '@/constants'
import { useLanguage } from '@/context/LanguageContext'
import { useUser } from '@clerk/clerk-expo'
import { haversine } from '@/lib/utils'
import Header from '@/components/Header'
import * as Haptics from 'expo-haptics'
import * as Location from 'expo-location'
import DateTimePicker from '@react-native-community/datetimepicker'
import Modal from 'react-native-modal'
import debounce from 'lodash/debounce'

// Constants
const MAX_DISTANCE_KM = 500
const MIN_DISTANCE_KM = 1
const RIDES_PER_PAGE = 10
const STATUS_OPTIONS = ['all', 'available', 'pending', 'ended']
const GENDER_OPTIONS = ['any', 'male', 'female']
const RECURRING_OPTIONS = ['all', 'recurring', 'nonrecurring']

interface SearchResult {
  id: string
  type: 'ride' | 'driver'
  name?: string
  origin?: string
  destination?: string
  distance?: number
  profile_image_url?: string
  ride_datetime?: string
  price?: number
  car_type?: string
  rating?: number
  is_recurring?: boolean
  recurring_days?: string[]
  origin_coordinates?: { latitude: number; longitude: number }
  destination_coordinates?: { latitude: number; longitude: number }
  status?: string
  available_seats?: number
  gender_preference?: 'male' | 'female' | 'any'
  waypoints?: Array<{
    address: string
    street: string
    latitude: number
    longitude: number
  }>
}

interface FilterOptions {
  type: 'all' | 'rides' | 'drivers'
  sortBy: 'price' | 'time' | 'rating'
  maxPrice?: number
  minRating?: number
  distance?: number
  status?: string[]
  date?: Date | null
  gender?: string
  recurring?: 'all' | 'recurring' | 'nonrecurring'
}

// Helper to parse DD/MM/YYYY HH:mm
function parseCustomDate(dateStr: string) {
  if (!dateStr) return new Date('');
  const [datePart, timePart] = dateStr.split(' ');
  if (!datePart || !timePart) return new Date('');
  const [day, month, year] = datePart.split('/').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  return new Date(year, month - 1, day, hour, minute);
}

// Helper to fetch driver image
async function fetchDriverImage(driverId: string): Promise<string | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', driverId));
    if (userDoc.exists()) {
      const userData = userDoc.data();
      return userData.driver?.profile_image_url || null;
    }
  } catch (err) {
    // Ignore
  }
  return null;
}

// Add type guard for toDate
function hasToDate(obj: any): obj is { toDate: () => Date } {
  return obj && typeof obj === 'object' && typeof obj.toDate === 'function';
}

const Search = () => {
  const router = useRouter()
  const params = useLocalSearchParams()
  const { t, language } = useLanguage()
  const { user } = useUser()
  const [searchQuery, setSearchQuery] = useState(params.searchQuery as string || '')
  const [allResults, setAllResults] = useState<SearchResult[]>([])
  const [displayedResults, setDisplayedResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null)
  const [hasMore, setHasMore] = useState(true)
  const [filters, setFilters] = useState<FilterOptions>({
    type: 'all',
    sortBy: 'time',
    maxPrice: undefined,
    minRating: undefined,
    distance: MAX_DISTANCE_KM,
    status: [],
    date: null,
    gender: 'any',
    recurring: 'all',
  })
  const [showDatePicker, setShowDatePicker] = useState(false)
  const searchTimeout = useRef<NodeJS.Timeout | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null)

  // Fetch user profile image
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (user?.id) {
        try {
          const userDoc = await getDoc(doc(db, 'users', user.id));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setProfileImageUrl(userData.profile_image_url || userData.driver?.profile_image_url || null);
          }
        } catch (error) {
          console.error('Error fetching user profile:', error);
        }
      }
    };
    fetchUserProfile();
  }, [user?.id]);

  // Initialize search with query from home page
  useEffect(() => {
    if (params.searchQuery) {
      handleSearch(params.searchQuery as string)
    }
  }, [params.searchQuery])

  // Fetch user location
  const fetchUserLocation = useCallback(async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        console.log('Location permission denied')
        return null
      }
      let location = await Location.getCurrentPositionAsync({})
      setUserLocation({ latitude: location.coords.latitude, longitude: location.coords.longitude })
      return { latitude: location.coords.latitude, longitude: location.coords.longitude }
    } catch (err) {
      console.error('Error fetching user location:', err)
      return null
    }
  }, [])

  // Debounced search handler
  const handleSearchInput = useCallback((text: string) => {
    setSearchQuery(text)
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    searchTimeout.current = setTimeout(() => {
      handleSearch(text)
    }, 400)
  }, [])

  // Fetch all rides
  const fetchAllRides = useCallback(async () => {
    setLoading(true)
    try {
      let rides: SearchResult[] = []
      let lastDoc = null
      let keepFetching = true
      while (keepFetching) {
        const ridesRef = collection(db, 'rides')
        const ridesQuery: Query<DocumentData> = lastDoc
          ? query(ridesRef, orderBy('ride_datetime', 'asc'), startAfter(lastDoc), limit(30))
          : query(ridesRef, orderBy('ride_datetime', 'asc'), limit(30))
        const ridesSnapshot: QuerySnapshot<DocumentData> = await getDocs(ridesQuery)
        if (ridesSnapshot.empty) {
          keepFetching = false
          break
        }
        for (const docSnap of ridesSnapshot.docs) {
          const ride = docSnap.data()
          if (!isValidRide(ride)) continue
          let profile_image_url: string | undefined = undefined
          if (ride.driver_id) {
            const imageUrl = await fetchDriverImage(ride.driver_id)
            if (imageUrl) {
              profile_image_url = imageUrl
            }
          }
          rides.push({
            id: docSnap.id,
            type: 'ride',
            origin: ride.origin_address,
            destination: ride.destination_address,
            ride_datetime: ride.ride_datetime,
            price: ride.price,
            car_type: ride.car_type,
            rating: ride.driver_rating,
            is_recurring: ride.is_recurring,
            recurring_days: ride.ride_days,
            distance: ride.origin_latitude && ride.origin_longitude && ride.destination_latitude && ride.destination_longitude
              ? haversine(
                  ride.origin_latitude,
                  ride.origin_longitude,
                  ride.destination_latitude,
                  ride.destination_longitude
                )
              : undefined,
            origin_coordinates: {
              latitude: ride.origin_latitude,
              longitude: ride.origin_longitude
            },
            destination_coordinates: {
              latitude: ride.destination_latitude,
              longitude: ride.destination_longitude
            },
            status: ride.status,
            available_seats: ride.available_seats,
            gender_preference: ride.required_gender,
            profile_image_url,
            waypoints: ride.waypoints
          })
        }
        lastDoc = ridesSnapshot.docs[ridesSnapshot.docs.length - 1]
        if (ridesSnapshot.docs.length < 30) keepFetching = false
      }
      setAllResults(rides)
      setCurrentIndex(RIDES_PER_PAGE)
      setHasMore(rides.length > RIDES_PER_PAGE)
    } catch (error) {
      console.error('Error fetching rides:', error)
      setAllResults([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [])

  // Apply filters to results
  const applyFilters = useCallback((results: SearchResult[]) => {
    let filtered = [...results]

    // Type filter
    if (filters.type !== 'all') {
      filtered = filtered.filter(item => {
        if (filters.type === 'rides') return item.type === 'ride'
        if (filters.type === 'drivers') return item.type === 'driver'
        return true
      })
    }

    // Search query filter
    if (searchQuery.trim()) {
      const searchText = searchQuery.toLowerCase().trim()
      filtered = filtered.filter(item => {
        const originMatch = item.origin?.toLowerCase().includes(searchText) ||
          item.origin?.toLowerCase().includes(searchText.replace('ة', 'ه')) ||
          item.origin?.toLowerCase().includes(searchText.replace('ه', 'ة'))
        const destMatch = item.destination?.toLowerCase().includes(searchText) ||
          item.destination?.toLowerCase().includes(searchText.replace('ة', 'ه')) ||
          item.destination?.toLowerCase().includes(searchText.replace('ه', 'ة'))
        return originMatch || destMatch
      })
    }

    // Distance filter
    if (filters.distance && filters.distance < MAX_DISTANCE_KM && userLocation) {
      filtered = filtered.filter(item => {
        if (item.origin_coordinates && item.distance) {
          const distanceToOrigin = haversine(
            userLocation.latitude,
            userLocation.longitude,
            item.origin_coordinates.latitude,
            item.origin_coordinates.longitude
          )
          return distanceToOrigin <= filters.distance!
        }
        return true
      })
    }

    // Status filter
    if (filters.status?.length && !filters.status.includes('all')) {
      filtered = filtered.filter(item => item.status && filters.status!.includes(item.status))
    }

    // Date filter
    if (filters.date) {
      const filterDay = filters.date.getDate();
      const filterMonth = filters.date.getMonth() + 1;
      const filterYear = filters.date.getFullYear();
      filtered = filtered.filter(item => {
        if (!item.ride_datetime) return false;
        let rideDateObj;
        if (typeof item.ride_datetime === 'string') {
          rideDateObj = parseCustomDate(item.ride_datetime);
        } else {
          const dt: any = item.ride_datetime;
          if (dt && typeof dt === 'object' && hasToDate(dt)) {
            rideDateObj = dt.toDate();
          } else {
            return false;
          }
        }
        return (
          rideDateObj.getDate() === filterDay &&
          rideDateObj.getMonth() + 1 === filterMonth &&
          rideDateObj.getFullYear() === filterYear
        );
      });
    }

    // Gender filter
    if (filters.gender && filters.gender !== 'any') {
      filtered = filtered.filter(item => item.gender_preference === filters.gender)
    }

    // Price filter
    if (filters.maxPrice) {
      filtered = filtered.filter(item => item.price && item.price <= filters.maxPrice!)
    }

    // Rating filter
    if (filters.minRating) {
      filtered = filtered.filter(item => item.rating && item.rating >= filters.minRating!)
    }

    // Recurring filter
    if (filters.recurring && filters.recurring !== 'all') {
      filtered = filtered.filter(item => {
        if (filters.recurring === 'recurring') return item.is_recurring === true
        if (filters.recurring === 'nonrecurring') return item.is_recurring === false
        return true
      })
    }

    // Sort results
    filtered.sort((a, b) => {
      switch (filters.sortBy) {
        case 'price':
          return (a.price || 0) - (b.price || 0)
        case 'time':
          return new Date(a.ride_datetime || '').getTime() - new Date(b.ride_datetime || '').getTime()
        case 'rating':
          return (b.rating || 0) - (a.rating || 0)
        default:
          return 0
      }
    })

    return filtered
  }, [filters, searchQuery, userLocation])

  // Debounced filter application
  const debouncedApplyFilters = useMemo(() => debounce((results: SearchResult[]) => {
    const filteredResults = applyFilters(results)
    setDisplayedResults(filteredResults.slice(0, currentIndex))
    setHasMore(filteredResults.length > currentIndex)
  }, 300), [applyFilters, currentIndex])

  // Handle search
  const handleSearch = useCallback(async (text: string) => {
    setSearchQuery(text)
    if (!text.trim()) {
      debouncedApplyFilters(allResults)
      return
    }
    setLoading(true)
    try {
      const filteredResults = applyFilters(allResults)
      setDisplayedResults(filteredResults.slice(0, RIDES_PER_PAGE))
      setCurrentIndex(RIDES_PER_PAGE)
      setHasMore(filteredResults.length > RIDES_PER_PAGE)
    } catch (error) {
      setDisplayedResults([])
      setHasMore(false)
    } finally {
      setLoading(false)
    }
  }, [allResults, applyFilters])

  // Load more results
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    setTimeout(() => {
      const filteredResults = applyFilters(allResults)
      const nextIndex = currentIndex + RIDES_PER_PAGE
      setDisplayedResults(filteredResults.slice(0, nextIndex))
      setCurrentIndex(nextIndex)
      setHasMore(filteredResults.length > nextIndex)
      setLoadingMore(false)
    }, 300)
  }, [loadingMore, hasMore, currentIndex, allResults, applyFilters])

  // Handle date change
  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(false)
    if (selectedDate) {
      setFilters(prev => ({ ...prev, date: selectedDate }))
    }
  }

  // Render filter modal
  const renderFilterModal = () => (
    <Modal
      isVisible={showFilters}
      onBackdropPress={() => setShowFilters(false)}
      style={{ justifyContent: 'flex-end', margin: 0 }}
    >
      <View className="bg-white rounded-t-3xl p-6 max-h-[80%]">
        <View className="flex-row justify-between items-center mb-6">
          <Text className={`text-xl font-CairoBold ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'تصفية النتائج' : 'Filter Results'}
          </Text>
          <TouchableOpacity onPress={() => setShowFilters(false)}>
            <Image source={icons.close} className="w-6 h-6" />
          </TouchableOpacity>
        </View>

        {/* Distance Filter */}
        <View className="mb-4">
          <Text className={`text-base font-CairoBold mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'المسافة (كم)' : 'Distance (km)'}
          </Text>
          <View className="flex-row items-center justify-between bg-gray-50 p-2 rounded-xl">
            <TouchableOpacity
              onPress={() => setFilters(prev => ({ ...prev, distance: Math.max((prev.distance || 0) - 1, MIN_DISTANCE_KM) }))}
              className="bg-primary/10 p-3 rounded-full"
            >
              <Text className="text-primary text-xl font-CairoBold">-</Text>
            </TouchableOpacity>
            <TextInput
              style={{ width: 60, textAlign: 'center' }}
              className="text-lg font-CairoBold text-gray-800 bg-transparent mx-2"
              keyboardType="numeric"
              value={filters.distance?.toString() || ''}
              onChangeText={val => {
                let num = parseInt(val.replace(/[^0-9]/g, ''))
                if (isNaN(num)) num = MIN_DISTANCE_KM
                if (num > MAX_DISTANCE_KM) num = MAX_DISTANCE_KM
                if (num < MIN_DISTANCE_KM) num = MIN_DISTANCE_KM
                setFilters(prev => ({ ...prev, distance: num }))
              }}
              placeholder={language === 'ar' ? 'المسافة' : 'Distance'}
              maxLength={3}
              returnKeyType="done"
            />
            <TouchableOpacity
              onPress={() => setFilters(prev => ({ ...prev, distance: Math.min((prev.distance || 0) + 1, MAX_DISTANCE_KM) }))}
              className="bg-primary/10 p-3 rounded-full"
            >
              <Text className="text-primary text-xl font-CairoBold">+</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Status Filter */}
        <View className="mb-4">
          <Text className={`text-base font-CairoBold mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'الحالة' : 'Status'}
          </Text>
          <View className="flex-row flex-wrap">
            {STATUS_OPTIONS.map((status) => (
              <TouchableOpacity
                key={status}
                onPress={() => {
                  let newStatus: string[]
                  if (status === 'all') {
                    newStatus = ['all']
                  } else {
                    newStatus = filters.status?.includes(status)
                      ? filters.status.filter(s => s !== status && s !== 'all')
                      : [...(filters.status?.filter(s => s !== 'all') || []), status]
                  }
                  setFilters(prev => ({ ...prev, status: newStatus }))
                }}
                className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                  filters.status?.includes(status)
                    ? status === 'all'
                      ? 'bg-orange-500'
                      : status === 'available'
                      ? 'bg-green-100'
                      : status === 'pending'
                      ? 'bg-yellow-100'
                      : 'bg-red-100'
                    : 'bg-gray-50'
                }`}
              >
                <Text
                  className={`font-CairoBold ${
                    filters.status?.includes(status)
                      ? status === 'all'
                        ? 'text-white'
                        : status === 'available'
                        ? 'text-green-700'
                        : status === 'pending'
                        ? 'text-yellow-700'
                        : 'text-red-700'
                      : 'text-gray-600'
                  }`}
                >
                  {language === 'ar'
                    ? status === 'all'
                      ? 'الكل'
                      : status === 'available'
                      ? 'متاح'
                      : status === 'pending'
                      ? 'قيد الانتظار'
                      : 'منتهي'
                    : status.charAt(0).toUpperCase() + status.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Date Filter */}
        <View className="mb-4">
          <Text className={`text-base font-CairoBold mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'التاريخ' : 'Date'}
          </Text>
          <TouchableOpacity
            onPress={() => setShowDatePicker(true)}
            className="bg-gray-50 p-3 rounded-xl border border-gray-200"
          >
            <Text className={`text-gray-700 font-CairoMedium ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {filters.date ? filters.date.toLocaleDateString() : language === 'ar' ? 'اختر التاريخ' : 'Select Date'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Gender Filter */}
        <View className="mb-4">
          <Text className={`text-base font-CairoBold mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'الجنس' : 'Gender'}
          </Text>
          <View className="flex-row flex-wrap">
            {GENDER_OPTIONS.map((gender) => (
              <TouchableOpacity
                key={gender}
                onPress={() => setFilters(prev => ({ ...prev, gender }))}
                className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                  filters.gender === gender
                    ? gender === 'any'
                      ? 'bg-orange-500'
                      : gender === 'male'
                      ? 'bg-blue-100'
                      : 'bg-pink-100'
                    : 'bg-gray-50'
                }`}
              >
                <Text
                  className={`font-CairoBold ${
                    filters.gender === gender
                      ? gender === 'any'
                        ? 'text-white'
                        : gender === 'male'
                        ? 'text-blue-700'
                        : 'text-pink-700'
                      : 'text-gray-600'
                  }`}
                >
                  {language === 'ar'
                    ? gender === 'any'
                      ? 'الكل'
                      : gender === 'male'
                      ? 'ذكر'
                      : 'أنثى'
                    : gender.charAt(0).toUpperCase() + gender.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Recurring Filter */}
        <View className="mb-4">
          <Text className={`text-base font-CairoBold mb-2 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
            {language === 'ar' ? 'تكرار الرحلة' : 'Recurring'}
          </Text>
          <View className="flex-row flex-wrap">
            {RECURRING_OPTIONS.map((option) => (
              <TouchableOpacity
                key={option}
                onPress={() => setFilters(prev => ({ ...prev, recurring: option as 'all' | 'recurring' | 'nonrecurring' }))}
                className={`px-4 py-2 rounded-full mr-2 mb-2 ${
                  filters.recurring === option
                    ? option === 'all'
                      ? 'bg-orange-500'
                      : option === 'recurring'
                      ? 'bg-blue-100'
                      : 'bg-gray-200'
                    : 'bg-gray-50'
                }`}
              >
                <Text className={`font-CairoBold ${
                  filters.recurring === option
                    ? option === 'all'
                      ? 'text-white'
                      : option === 'recurring'
                      ? 'text-blue-700'
                      : 'text-gray-700'
                    : 'text-gray-600'
                }`}>
                  {language === 'ar'
                    ? option === 'all'
                      ? 'الكل'
                      : option === 'recurring'
                      ? 'متكررة'
                      : 'غير متكررة'
                    : option === 'all'
                    ? 'All'
                    : option === 'recurring'
                    ? 'Recurring'
                    : 'Non-Recurring'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Apply Filters Button */}
        <View className="flex-row space-x-3 mt-4">
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setFilters({
                type: 'all',
                sortBy: 'time',
                maxPrice: undefined,
                minRating: undefined,
                distance: MAX_DISTANCE_KM,
                status: [],
                date: null,
                gender: 'any',
                recurring: 'all' as 'all',
              })
            }}
            className="flex-1 bg-red-50 py-4 rounded-xl border border-red-200"
          >
            <Text className="text-red-500 text-center font-CairoBold text-lg">
              {language === 'ar' ? 'إعادة تعيين' : 'Reset'}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
              setShowFilters(false)
              debouncedApplyFilters(allResults)
            }}
            className="flex-1 bg-orange-500 py-4 rounded-xl"
          >
            <Text className="text-white text-center font-CairoBold text-lg">
              {language === 'ar' ? 'تطبيق' : 'Apply'}
            </Text>
          </TouchableOpacity>
        </View>

        {showDatePicker && (
          <DateTimePicker
            value={filters.date || new Date()}
            mode="date"
            display={Platform.OS === 'ios' ? 'spinner' : 'default'}
            onChange={handleDateChange}
            minimumDate={new Date()}
          />
        )}
      </View>
    </Modal>
  )

  // Render search result
  const renderSearchResult = ({ item }: { item: SearchResult }) => {
    if (item.type === 'ride') {
      const dateObj = parseCustomDate(item.ride_datetime || '')
      const dayOfWeek = dateObj.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US', { weekday: 'long' })
      const dateDisplay = dateObj.toLocaleDateString(language === 'ar' ? 'ar-EG' : 'en-US')
      const timeDisplay = dateObj.toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })
      const statusColor = item.status === 'available' ? 'bg-green-50 text-green-600' : 
                         item.status === 'pending' ? 'bg-yellow-50 text-yellow-600' : 
                         item.status === 'ended' ? 'bg-red-50 text-red-600' : 'bg-gray-100 text-gray-700'

      return (
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
            router.push({ pathname: "/(root)/ride-details/[id]", params: { id: item.id } })
          }}
          className="bg-white p-4 rounded-2xl mb-3 mx-2"
          style={Platform.OS === 'android' ? { elevation: 5 } : styles.iosShadow}
        >
          <View className={`absolute top-4 ${language === 'ar' ? 'left-4' : 'right-4'}`}>
            <View className={`px-2 py-1 rounded-full ${statusColor}`}>
              <Text className={`text-xs ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'}`}>
                {item.status === 'ended' ? (language === 'ar' ? 'منتهي' : 'Ended') :
                 item.status === 'pending' ? (language === 'ar' ? 'قيد الانتظار' : 'Pending') :
                 (language === 'ar' ? 'متاح' : 'Available')}
              </Text>
            </View>
          </View>

          <View className={`flex-row items-center mb-3 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
            <Image
              source={item.profile_image_url ? { uri: item.profile_image_url } : icons.profile}
              className={`w-10 h-10 rounded-full ${language === 'ar' ? 'ml-3' : 'mr-3'}`}
            />
            <View className={language === 'ar' ? 'items-end' : 'items-start'}>
              <Text className={`text-base ${language === 'ar' ? 'font-CairoBold' : 'font-JakartaBold'} ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {language === 'ar' ? 'السائق' : 'Driver'}
              </Text>
              <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {item.car_type}
              </Text>
            </View>
          </View>

          <View className={`flex-row items-start mb-3 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
            <View className="flex-1">
              <View className={`flex-row items-center mb-1 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                <Image source={icons.pin} resizeMode="contain" className={`w-5 h-5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} ${language === 'ar' ? 'ml-2' : 'mr-2'}`}>
                  {language === 'ar' ? 'من' : 'From'}:
                </Text>
                <Text className={`text-base ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                  {item.origin}
                </Text>
              </View>
              {item.waypoints && item.waypoints.length > 0 && item.waypoints.map((waypoint, index) => (
                <View key={index} className={`flex-row items-center mb-1 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                  <Image source={icons.map} resizeMode="contain" tintColor="#F79824" className={`w-5 h-5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                  <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} ${language === 'ar' ? 'ml-2' : 'mr-2'}`}>
                    {language === 'ar' ? 'محطة' : 'Stop'} {index + 1}:
                  </Text>
                  <Text className={`text-base ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                    {waypoint.address}
                  </Text>
                </View>
              ))}
              <View className={`flex-row items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
                <Image source={icons.target} resizeMode="contain" className={`w-5 h-5 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
                <Text className={`text-sm text-gray-500 ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} ${language === 'ar' ? 'ml-2' : 'mr-2'}`}>
                  {language === 'ar' ? 'إلى' : 'To'}:
                </Text>
                <Text className={`text-base ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} flex-1 ${language === 'ar' ? 'text-right' : 'text-left'}`} numberOfLines={1}>
                  {item.destination}
                </Text>
              </View>
            </View>
          </View>

          <View className={`flex-row flex-wrap gap-y-2 justify-between items-center ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
            <View className={`flex-row items-center mb-1 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
              <Image source={icons.calendar} className={`w-4 h-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
              <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {dayOfWeek}
              </Text>
            </View>
            <View className={`flex-row items-center mb-1 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
              <Image source={icons.calendar} className={`w-4 h-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
              <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {dateDisplay}
              </Text>
            </View>
            <View className={`flex-row items-center mb-1 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
              <Image source={icons.clock} className={`w-4 h-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
              <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {timeDisplay}
              </Text>
            </View>
            <View className={`flex-row items-center mb-1 ${language === 'ar' ? 'flex-row-reverse' : 'flex-row'}`}>
              <Image source={icons.person} className={`w-4 h-4 ${language === 'ar' ? 'ml-1' : 'mr-1'}`} />
              <Text className={`text-sm ${language === 'ar' ? 'font-CairoMedium' : 'font-JakartaMedium'} text-gray-600 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
                {item.available_seats} {language === 'ar' ? 'مقاعد' : 'seats'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      )
    }

    return (
      <TouchableOpacity
        className="bg-white p-4 rounded-xl mb-3 shadow-sm border border-gray-100"
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
          router.push({ pathname: "/(root)/driver-profile/[id]", params: { id: item.id } })
        }}
      >
        <View className="flex-row items-center">
          <View className="w-14 h-14 rounded-full overflow-hidden bg-gray-100 border-2 border-primary/20">
            {item.profile_image_url ? (
              <Image source={{ uri: item.profile_image_url }} className="w-full h-full" />
            ) : (
              <View className="w-full h-full bg-primary items-center justify-center">
                <Text className="text-white text-xl">{item.name?.[0]?.toUpperCase() || 'D'}</Text>
              </View>
            )}
          </View>
          <View className="ml-4 flex-1">
            <Text className={`text-lg font-CairoBold text-gray-800 ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {item.name}
            </Text>
            <View className="flex-row flex-wrap items-center mt-1">
              <View className="bg-gray-50 px-3 py-1 rounded-full mr-2">
                <Text className="text-gray-600 text-sm">{language === 'ar' ? 'سائق' : 'Driver'}</Text>
              </View>
              {item.car_type && (
                <View className="bg-gray-50 px-3 py-1 rounded-full mr-2">
                  <Text className="text-gray-600 text-sm">{item.car_type}</Text>
                </View>
              )}
              {item.rating && (
                <View className="bg-gray-50 px-3 py-1 rounded-full">
                  <View className="flex-row items-center">
                    <Image source={icons.star} className="w-3 h-3 mr-1" tintColor="#F59E0B" />
                    <Text className="text-gray-600 text-sm">{item.rating.toFixed(1)}</Text>
                  </View>
                </View>
              )}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    )
  }

  // Helper to determine if a ride is valid
  const isValidRide = (ride: any) => {
    const rideDate = parseCustomDate(ride.ride_datetime)
    const currentDate = new Date()
    return rideDate > currentDate
  }

  // Initial fetch
  useEffect(() => {
    fetchAllRides()
    fetchUserLocation()
  }, [fetchAllRides, fetchUserLocation])

  // Apply filters when filters or results change
  useEffect(() => {
    debouncedApplyFilters(allResults)
  }, [allResults, filters, debouncedApplyFilters])

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Header profileImageUrl={profileImageUrl} title={t.Search} />
      <View className="px-4 py-3 bg-white border-b border-gray-100">
        <View className="flex-row items-center">
          <View className="flex-1 flex-row items-center bg-gray-50 rounded-full px-4 py-2 mr-2">
            <Image source={icons.search} className="w-5 h-5" tintColor="#6B7280" />
            <TextInput
              placeholder={language === 'ar' ? 'ابحث عن رحلات أو سائقين' : 'Search rides or drivers'}
              value={searchQuery}
              onChangeText={handleSearchInput}
              className={`flex-1 ${language === 'ar' ? 'text-right' : 'text-left'} font-CairoBold text-gray-700`}
              placeholderTextColor="#9CA3AF"
            />
          </View>
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              setShowFilters(true)
            }}
            className="bg-gray-50 p-2 rounded-full"
          >
            <Image source={icons.filter} className="w-6 h-6" tintColor="#6B7280" />
          </TouchableOpacity>
        </View>
      </View>

      <View className="flex-1 px-4">
        {loading ? (
          <View className="flex-1 justify-center items-center py-8">
            <ActivityIndicator size="large" color="#4F46E5" />
          </View>
        ) : displayedResults.length > 0 ? (
          <FlatList
            data={displayedResults}
            renderItem={renderSearchResult}
            keyExtractor={(item) => `${item.type}-${item.id}`}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 16, paddingBottom: 80 }}
            onEndReached={handleLoadMore}
            onEndReachedThreshold={0.5}
            ListFooterComponent={() => (
              loadingMore ? (
                <View className="py-4">
                  <ActivityIndicator size="small" color="#4F46E5" />
                </View>
              ) : hasMore ? (
                <TouchableOpacity
                  onPress={handleLoadMore}
                  className="bg-primary/10 py-3 rounded-xl mb-4"
                >
                  <Text className="text-primary text-center font-CairoBold">
                    {language === 'ar' ? 'تحميل المزيد' : 'Load More'}
                  </Text>
                </TouchableOpacity>
              ) : null
            )}
          />
        ) : (
          <View className="flex-1 items-center justify-center py-20">
            <Image source={icons.search} className="w-16 h-16 mb-4" tintColor="#9CA3AF" />
            <Text className={`text-gray-500 text-lg font-CairoBold ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {language === 'ar' ? 'لا توجد نتائج' : 'No results found'}
            </Text>
            <Text className={`text-gray-400 text-base mt-2 font-CairoBold ${language === 'ar' ? 'text-right' : 'text-left'}`}>
              {language === 'ar' ? 'جرب كلمة بحث مختلفة' : 'Try a different search term'}
            </Text>
          </View>
        )}
    </View>

      {renderFilterModal()}
    </SafeAreaView>
  )
}

export default Search

const styles = StyleSheet.create({
  iosShadow: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
  },
})